"""Sync service: pulls data from Red Hat APIs into local database.

Handles on-demand sync for cases, contacts, entitlements, clusters,
and lifecycle data. Each sync method is idempotent — it upserts
records based on external identifiers.
"""

import json
import logging
from datetime import datetime

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    Account,
    AccountCluster,
    AccountContact,
    AccountEntitlement,
    Product,
    ProductLifecycle,
    SupportCase,
)
from .hydra_client import HydraClient
from .ocm_client import OcmClient
from .lifecycle_client import LifecycleClient

logger = logging.getLogger("tam_copilot.sync")


class SyncService:
    """Orchestrates data synchronization from Red Hat APIs."""

    def __init__(
        self,
        hydra: HydraClient | None,
        ocm: OcmClient | None,
        lifecycle: LifecycleClient | None,
    ):
        self.hydra = hydra
        self.ocm = ocm
        self.lifecycle = lifecycle

    async def _guess_entitlement_product_id(
        self, db: AsyncSession, entitlement_name: str, sku: str | None
    ) -> int | None:
        """Map Hydra entitlement text to a catalog Product row (longest name match)."""
        blob = f"{entitlement_name} {sku or ''}".lower()
        products = (await db.execute(select(Product).order_by(Product.name))).scalars().all()
        best_id: int | None = None
        best_len = 0
        for p in products:
            needle = (p.name or "").lower()
            if needle and needle in blob and len(needle) > best_len:
                best_id = p.id
                best_len = len(needle)
        return best_id

    # -- Account metadata (Hydra) ----------------------------------------------

    async def sync_account_metadata(self, db: AsyncSession, account: Account) -> dict[str, str | bool | None]:
        """Pull hasTAM, CSM info, and strategic flag from Hydra get_account."""
        if not self.hydra:
            raise RuntimeError("Hydra client not configured")

        data = await self.hydra.get_account(account.account_number)
        if isinstance(data, dict) and data.get("error"):
            logger.warning("sync.account_meta | account=%s error=%s", account.account_number, data.get("status"))
            return {}

        account.has_tam = bool(data.get("hasTAM", False))
        account.csm_name = data.get("csmUserName") or None
        account.csm_sso_username = data.get("csmUserSSOName") or None
        account.strategic = bool(data.get("strategic", False))

        await db.commit()
        logger.info(
            "sync.account_meta | account=%s has_tam=%s csm=%s strategic=%s",
            account.account_number, account.has_tam, account.csm_name, account.strategic,
        )
        return {
            "has_tam": account.has_tam,
            "csm_name": account.csm_name,
            "csm_sso_username": account.csm_sso_username,
            "strategic": account.strategic,
        }

    # -- Entitlements (OCM subscriptions) -------------------------------------

    async def sync_entitlements(self, db: AsyncSession, account: Account) -> int:
        """Replace cached entitlements with OCM subscription rows for the account.

        The published Hydra Support API exposes ``/v1/accounts/{number}/contacts``
        but **not** ``/v1/accounts/{number}/entitlements`` (that path is not in the
        public OpenAPI catalog). Customer OpenShift subscriptions are listed under
        Accounts Management / OCM by resolving the organization whose
        ``ebs_account_id`` matches the Red Hat account number, then listing all
        subscriptions in that organization.
        """
        if not self.ocm:
            raise RuntimeError(
                "OCM is not configured — cannot sync subscription entitlements. "
                "Use the same Red Hat offline token as Hydra (OCM is initialized with it)."
            )

        org = await self.ocm.find_org_by_ebs_account(account.account_number)
        if not org:
            raise RuntimeError(
                "No OCM organization found for this account number (ebs_account_id). "
                "The SSO token may only see your home organization — use an OCM token "
                "with access to the customer's organization to sync subscriptions."
            )

        subs = await self.ocm.list_all_subscriptions_for_organization(str(org["id"]))

        await db.execute(
            delete(AccountEntitlement).where(AccountEntitlement.account_id == account.id)
        )

        count = 0
        for sub in subs:
            plan = sub.get("plan") or {}
            plan_id = str(plan.get("id") or plan.get("name") or "").strip()
            display = str(sub.get("display_name") or "").strip()
            ext_cluster = str(sub.get("external_cluster_id") or "").strip()
            title_bits = [b for b in (display, plan_id) if b]
            name = (
                " — ".join(title_bits)
                if title_bits
                else f"OpenShift subscription {sub.get('id', '')}"
            )[:500]

            sku_raw = ext_cluster or plan_id or str(sub.get("cluster_id") or sub.get("id") or "")
            sku = (sku_raw[:100] if sku_raw else None) or None

            pid = await self._guess_entitlement_product_id(db, name, sku)

            start_raw = (
                sub.get("creation_timestamp")
                or sub.get("created_at")
                or sub.get("createdAt")
            )
            start_s = str(start_raw) if start_raw else None

            end_raw = sub.get("contract_end_date") or sub.get("expiration_date")
            end_s = str(end_raw) if end_raw else None

            ent = AccountEntitlement(
                account_id=account.id,
                product_id=pid,
                sku=sku,
                entitlement_name=name,
                service_level=(str(sub.get("service_system_type") or sub.get("billing_model_code") or "") or None),
                support_level=(str(sub.get("support_level") or "") or None),
                start_date=_parse_date(start_s) if start_s else None,
                end_date=_parse_date(end_s) if end_s else None,
                quantity=1,
            )
            db.add(ent)
            count += 1

        await db.commit()
        logger.info("sync.entitlements | account=%s synced=%d (OCM subscriptions)", account.account_number, count)
        return count

    # -- Contacts (Hydra) ------------------------------------------------------

    async def sync_contacts(self, db: AsyncSession, account: Account) -> int:
        """Pull contacts from Hydra and upsert into local DB."""
        if not self.hydra:
            raise RuntimeError("Hydra client not configured")

        raw = await self.hydra.list_contacts(account.account_number)
        if not raw:
            return 0

        # Only delete synced customer contacts, keep manual Red Hat team entries
        await db.execute(
            delete(AccountContact).where(
                AccountContact.account_id == account.id,
                AccountContact.team == "customer",
            )
        )

        count = 0
        for item in raw:
            contact = AccountContact(
                account_id=account.id,
                name=_full_name(item),
                sso_username=item.get("ssoUsername", ""),
                email=item.get("email", ""),
                phone=item.get("phone", ""),
                title=item.get("title", ""),
                area=item.get("area", ""),
                is_tam_contact=item.get("isTAMContact", False),
                is_org_admin=item.get("isOrgAdmin", False),
                contact_type=item.get("contactType", ""),
                classification=item.get("classification", ""),
                relationship_status=item.get("relationshipStatus", ""),
                team="customer",
                status="active",
            )
            db.add(contact)
            count += 1

        await db.commit()
        logger.info("sync.contacts | account=%s synced=%d", account.account_number, count)
        return count

    # -- Cases (Hydra) ----------------------------------------------------------

    async def sync_cases(self, db: AsyncSession, account: Account) -> int:
        """Pull support cases from Hydra and replace local cache."""
        if not self.hydra:
            raise RuntimeError("Hydra client not configured")

        raw = await self.hydra.list_cases(
            account.account_number, include_closed=True, max_results=500,
        )
        if not raw:
            return 0

        await db.execute(
            delete(SupportCase).where(SupportCase.account_id == account.id)
        )

        count = 0
        for item in raw:
            sc = SupportCase(
                account_id=account.id,
                case_number=item.get("caseNumber", ""),
                summary=item.get("summary", ""),
                status=item.get("status", ""),
                severity=item.get("severity"),
                product=item.get("product"),
                version=item.get("version"),
                case_type=item.get("caseType"),
                owner=item.get("ownerId"),
                contact_name=item.get("contactName"),
                contact_sso=item.get("contactSSOName"),
                sla=item.get("entitlementSla"),
                sbr_groups=", ".join(item.get("sbrGroups", [])) if item.get("sbrGroups") else None,
                is_proactive=bool(item.get("proactive", False)),
                is_escalated=bool(item.get("customerEscalation", False)),
                cluster_id=item.get("openshiftClusterID"),
                created_date=_parse_datetime(item.get("createdDate")),
                last_modified_date=_parse_datetime(item.get("lastModifiedDate")),
                last_modified_by=item.get("lastModifiedById"),
                closed_date=_parse_datetime(item.get("lastClosedAt")),
                resolution=item.get("resolution"),
            )
            db.add(sc)
            count += 1

        await db.commit()
        logger.info("sync.cases | account=%s synced=%d", account.account_number, count)
        return count

    # -- Clusters (OCM) --------------------------------------------------------

    async def sync_clusters(self, db: AsyncSession, account: Account) -> int:
        """Pull cluster telemetry from OCM subscriptions into local DB."""
        if not self.ocm:
            raise RuntimeError("OCM client not configured")

        org = await self.ocm.find_org_by_ebs_account(account.account_number)
        if not org:
            logger.warning("sync.clusters | no OCM org for account=%s", account.account_number)
            return 0

        subs = await self.ocm.list_subscriptions(org_id=org["id"])

        await db.execute(
            delete(AccountCluster).where(AccountCluster.account_id == account.id)
        )

        count = 0
        for sub in subs:
            metrics = (sub.get("metrics") or [{}])[0] if sub.get("metrics") else {}
            nodes = metrics.get("nodes", {})
            cpu = metrics.get("compute_nodes_cpu", {})
            mem = metrics.get("compute_nodes_memory", {})
            upgrade = metrics.get("upgrade", {})

            cluster = AccountCluster(
                account_id=account.id,
                external_cluster_id=sub.get("external_cluster_id", ""),
                display_name=sub.get("display_name", ""),
                status=sub.get("status", ""),
                console_url=sub.get("console_url", ""),
                openshift_version=metrics.get("openshift_version", ""),
                lifecycle_phase=metrics.get("state", ""),
                master_nodes=nodes.get("master", {}).get("total", {}).get("value"),
                compute_nodes=nodes.get("compute", {}).get("total", {}).get("value"),
                vcpu_total=cpu.get("total", {}).get("value"),
                memory_gb=_bytes_to_gb(mem.get("total", {}).get("value")),
                cloud_provider=metrics.get("cloud_provider", sub.get("cloud_provider_id", "")),
                arch=metrics.get("arch", ""),
                health_state=metrics.get("health_state", ""),
                critical_alerts=metrics.get("critical_alerts_firing", 0),
                upgrade_available=upgrade.get("available", ""),
                upgrade_state=upgrade.get("state", ""),
                last_telemetry_at=_parse_datetime(sub.get("last_telemetry_date")),
            )
            db.add(cluster)
            count += 1

        await db.commit()
        logger.info("sync.clusters | account=%s synced=%d", account.account_number, count)
        return count

    # -- Lifecycle (public API) ------------------------------------------------

    async def sync_lifecycle(self, db: AsyncSession, account: Account, product_names: list[str] | None = None) -> int:
        """Pull lifecycle phases for specified products."""
        if not self.lifecycle:
            raise RuntimeError("Lifecycle client not configured")

        if not product_names:
            product_names = _default_products()

        await db.execute(
            delete(ProductLifecycle).where(ProductLifecycle.account_id == account.id)
        )

        count = 0
        for name in product_names:
            product = await self.lifecycle.get_product(name)
            if not product:
                continue
            for ver in product.get("versions", []):
                phases = {p["name"]: p.get("date") for p in ver.get("phases", [])}
                entry = ProductLifecycle(
                    account_id=account.id,
                    product_name=product.get("name", name),
                    version=ver.get("name", ""),
                    phases_json=json.dumps(ver.get("phases", [])),
                    current_phase=_current_phase(phases),
                    ga_date=_parse_date(phases.get("General availability")),
                    full_support_end=_parse_date(phases.get("Full support")),
                    maintenance_end=_parse_date(phases.get("Maintenance support")),
                    eus_end=_parse_date(phases.get("Extended update support")),
                )
                db.add(entry)
                count += 1

        await db.commit()
        logger.info("sync.lifecycle | account=%s synced=%d versions", account.account_number, count)
        return count

    # -- Full sync -------------------------------------------------------------

    async def sync_all(self, db: AsyncSession, account: Account) -> dict[str, int]:
        """Run all sync operations for an account."""
        results: dict[str, int] = {}
        if self.hydra:
            await self.sync_account_metadata(db, account)
            results["contacts"] = await self.sync_contacts(db, account)
            results["cases"] = await self.sync_cases(db, account)
        if self.ocm:
            try:
                results["entitlements"] = await self.sync_entitlements(db, account)
            except RuntimeError as exc:
                logger.warning("sync_all.entitlements | account=%s skipped: %s", account.account_number, exc)
                results["entitlements"] = -1
            results["clusters"] = await self.sync_clusters(db, account)
        if self.lifecycle:
            results["lifecycle"] = await self.sync_lifecycle(db, account)
        return results


# -- Helpers -------------------------------------------------------------------

def _parse_date(val: str | None):
    """Best-effort date parsing from various API formats."""
    if not val:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            return datetime.strptime(val[:26], fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def _parse_datetime(val: str | None):
    if not val:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ"):
        try:
            return datetime.strptime(val[:26], fmt)
        except (ValueError, TypeError):
            continue
    return None


def _full_name(contact: dict) -> str:
    first = contact.get("firstName", contact.get("first_name", ""))
    last = contact.get("lastName", contact.get("last_name", ""))
    return f"{first} {last}".strip() or contact.get("name", "Unknown")


def _bytes_to_gb(val) -> float | None:
    if val is None:
        return None
    try:
        return round(float(val) / (1024 ** 3), 1)
    except (TypeError, ValueError):
        return None


def _current_phase(phases: dict[str, str | None]) -> str | None:
    """Determine the current lifecycle phase based on dates."""
    from datetime import date
    today = date.today()
    ordered = [
        ("Extended update support", phases.get("Extended update support")),
        ("Maintenance support", phases.get("Maintenance support")),
        ("Full support", phases.get("Full support")),
        ("General availability", phases.get("General availability")),
    ]
    for phase_name, end_date_str in ordered:
        d = _parse_date(end_date_str)
        if d and today <= d:
            return phase_name
    return "End of life"


def _default_products() -> list[str]:
    return [
        "Red Hat OpenShift Container Platform",
        "Red Hat Enterprise Linux",
        "Red Hat Ansible Automation Platform",
        "Red Hat OpenShift Virtualization",
        "Red Hat Advanced Cluster Management for Kubernetes",
        "Red Hat Quay",
    ]
