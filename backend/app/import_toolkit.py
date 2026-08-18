"""Import TAM Toolkit Unified data from CSV files into PostgreSQL.

Usage:
    cd backend && python -m app.import_toolkit

Reads CSVs from data/seed/ and populates the database in dependency order:
  1. Reference data (verticals, segments, products/entitlements)
  2. Users (managers, team leads, TAMs, CS)
  3. Accounts
  4. Account assignments (TAM, team_lead, cs, manager)
  5. Account entitlements (TAM subscriptions)
  6. Engagement
  7. Action plans (unified)

Idempotent: uses INSERT ... ON CONFLICT DO NOTHING or upsert logic.
"""

import asyncio
import csv
import io
import logging
import re
import sys
from datetime import date, datetime
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from .auth import hash_password
from .database import engine, async_session, Base
from .models import (
    Account,
    AccountAssignment,
    AccountEntitlement,
    ActionPlan,
    AdminUser,
    Engagement,
    Product,
    Segment,
    Vertical,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-5s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger("import_toolkit")

SEED_DIR = Path(__file__).resolve().parent.parent / "data" / "seed"
DEFAULT_PASSWORD = hash_password("123456")

ACRONYM_TO_PRODUCT = {
    "OCP": "OpenShift",
    "PLT": "RHEL",
    "MW": "Middleware",
    "AAP": "Ansible Automation Platform",
    "OSP": "OpenStack Platform",
    "STR": "Storage",
    "ENT": "Enterprise",
    "OTH": "Other",
    "BKP": None,
    "DOCP": "OpenShift",
    "DPLT": "RHEL",
    "DMW": "Middleware",
    "DAAP": "Ansible Automation Platform",
    "DOSP": "OpenStack Platform",
    "SAP": "SAP Solutions",
    "PLT3": "RHEL",
}


def _read_csv(filename: str) -> list[dict]:
    path = SEED_DIR / filename
    content = path.read_text(encoding="utf-8")
    reader = csv.DictReader(io.StringIO(content))
    return [row for row in reader]


def _slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    return re.sub(r"[\s_]+", "-", s)


def parse_tam_column(raw: str) -> list[tuple[str, str]]:
    """Parse 'hcardena (OCP), masardis (PLT)' -> [('hcardena','OCP'), ...]"""
    if not raw or raw.startswith("Error:"):
        return []
    results = []
    for chunk in raw.split(","):
        chunk = chunk.strip()
        m = re.match(r"(\w+)\s*\((\w+)\)", chunk)
        if m:
            results.append((m.group(1), m.group(2)))
    return results


def parse_cs_column(raw: str) -> list[tuple[str, str]]:
    """Parse 'emmorale (CSA), rwattcha (CSA)' -> [('emmorale','CSA'), ...]"""
    return parse_tam_column(raw)


def parse_subscriptions(raw: str) -> list[dict]:
    """Parse '2026-09-29: 1-OCP | 1-PLT' or '2026-12-26: 1-OCP | 1-PLT | 2027-03-01: 1-AAP'.

    Returns list of {end_date, quantity, acronym}.
    """
    if not raw or raw.startswith("NOT FOUND") or raw.startswith("Error:"):
        return []
    results = []
    current_date = None
    for part in re.split(r"\s*\|\s*", raw):
        part = part.strip()
        date_match = re.match(r"(\d{4}-\d{2}-\d{2}):\s*(.*)", part)
        if date_match:
            current_date = date_match.group(1)
            part = date_match.group(2).strip()
        qty_match = re.match(r"(\d+)-(\w+)", part)
        if qty_match and current_date:
            results.append({
                "end_date": current_date,
                "quantity": int(qty_match.group(1)),
                "acronym": qty_match.group(2),
            })
    return results


async def ensure_product(db: AsyncSession, name: str, cache: dict) -> int | None:
    if not name:
        return None
    if name in cache:
        return cache[name]
    prod = await db.scalar(select(Product).where(Product.name == name))
    if not prod:
        prod = Product(name=name, slug=_slugify(name))
        db.add(prod)
        await db.flush()
    cache[name] = prod.id
    return prod.id


async def ensure_user(db: AsyncSession, username: str, role: str, cache: dict,
                      manager_id: int | None = None) -> int:
    if username in cache:
        return cache[username]
    user = await db.scalar(select(AdminUser).where(AdminUser.username == username))
    if not user:
        user = AdminUser(
            username=username,
            password_hash=DEFAULT_PASSWORD,
            role=role,
            is_active=True,
            manager_id=manager_id,
            sso_username=f"rh-ee-{username}",
        )
        db.add(user)
        await db.flush()
    cache[username] = user.id
    return user.id


async def run_import():
    log.info("Starting TAM Toolkit import from %s", SEED_DIR)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        product_cache: dict[str, int] = {}
        user_cache: dict[str, int] = {}
        vertical_cache: dict[str, int] = {}
        segment_cache: dict[str, int] = {}

        # ------------------------------------------------------------------
        # 0. Reference data: verticals, segments, products
        # ------------------------------------------------------------------
        for v in await db.scalars(select(Vertical)):
            vertical_cache[v.name] = v.id
        for s in await db.scalars(select(Segment)):
            segment_cache[s.name] = s.id
        for p in await db.scalars(select(Product)):
            product_cache[p.name] = p.id

        for name in set(ACRONYM_TO_PRODUCT.values()):
            if name:
                await ensure_product(db, name, product_cache)

        log.info("Reference data: %d verticals, %d segments, %d products",
                 len(vertical_cache), len(segment_cache), len(product_cache))

        # ------------------------------------------------------------------
        # 1. Users: managers, team leads, TAMs/CS from toolkit list
        # ------------------------------------------------------------------
        managers_csv = _read_csv("managers.csv")
        manager_usernames = [r["MANAGERS"].strip() for r in managers_csv if r["MANAGERS"].strip()]
        for uname in manager_usernames:
            await ensure_user(db, uname, "manager", user_cache)
        log.info("Managers: %d", len(manager_usernames))

        tl_csv = _read_csv("team_leads.csv")
        tl_usernames = [r["TEAM LEAD"].strip() for r in tl_csv if r["TEAM LEAD"].strip()]
        for uname in tl_usernames:
            await ensure_user(db, uname, "tam", user_cache)
        log.info("Team leads: %d", len(tl_usernames))

        toolkit_rows = _read_csv("tam_toolkit_list.csv")
        tam_set: set[str] = set()
        cs_set: set[str] = set()
        for row in toolkit_rows:
            for uname, _ in parse_tam_column(row.get("TAM", "")):
                tam_set.add(uname)
            for uname, _ in parse_cs_column(row.get("CS", "")):
                cs_set.add(uname)

        for uname in tam_set:
            await ensure_user(db, uname, "tam", user_cache)
        for uname in cs_set:
            await ensure_user(db, uname, "tam", user_cache)
        log.info("TAMs: %d, CS: %d", len(tam_set), len(cs_set))

        await db.commit()

        # ------------------------------------------------------------------
        # 2. Accounts
        # ------------------------------------------------------------------
        account_cache: dict[str, int] = {}
        existing = await db.scalars(select(Account))
        for acct in existing:
            account_cache[acct.account_number] = acct.id

        created_accounts = 0
        for row in toolkit_rows:
            acct_num = row.get("ACCOUNT NUMBER", "").strip()
            if not acct_num or acct_num in account_cache:
                continue
            status = row.get("STATUS", "").strip()
            vert_name = row.get("VERTICAL", "").strip()
            seg_name = row.get("SEGMENT", "").strip()

            tam_entries = parse_tam_column(row.get("TAM", ""))
            primary_tam_id = None
            if tam_entries:
                primary_uname = tam_entries[0][0]
                primary_tam_id = user_cache.get(primary_uname)

            acct = Account(
                name=row.get("CUSTOMER NAME", "").strip(),
                account_number=acct_num,
                region=row.get("REGION", "").strip() or None,
                country=row.get("COUNTRY", "").strip() or None,
                vertical_id=vertical_cache.get(vert_name),
                segment_id=segment_cache.get(seg_name),
                tam_user_id=primary_tam_id,
                toolkit_sheet_id=row.get("TAM TOOLKIT SHEET ID", "").strip() or None,
                is_active=(status == "Active"),
            )
            db.add(acct)
            await db.flush()
            account_cache[acct_num] = acct.id
            created_accounts += 1

        await db.commit()
        log.info("Accounts: %d created, %d total", created_accounts, len(account_cache))

        # ------------------------------------------------------------------
        # 3. Account assignments
        # ------------------------------------------------------------------
        created_assignments = 0
        for row in toolkit_rows:
            acct_num = row.get("ACCOUNT NUMBER", "").strip()
            acct_id = account_cache.get(acct_num)
            if not acct_id:
                continue

            # TAM assignments
            tam_entries = parse_tam_column(row.get("TAM", ""))
            for i, (uname, spec) in enumerate(tam_entries):
                uid = user_cache.get(uname)
                if not uid:
                    continue
                atype = "backup" if spec == "BKP" else "tam"
                existing_a = await db.scalar(
                    select(AccountAssignment).where(
                        AccountAssignment.account_id == acct_id,
                        AccountAssignment.user_id == uid,
                        AccountAssignment.assignment_type == atype,
                    )
                )
                if not existing_a:
                    prod_name = ACRONYM_TO_PRODUCT.get(spec)
                    prod_id = product_cache.get(prod_name) if prod_name else None
                    db.add(AccountAssignment(
                        account_id=acct_id,
                        user_id=uid,
                        assignment_type=atype,
                        specialization=spec if spec != "BKP" else None,
                        is_primary=(i == 0 and atype == "tam"),
                        product_id=prod_id,
                    ))
                    created_assignments += 1

            # CS assignments
            cs_entries = parse_cs_column(row.get("CS", ""))
            for uname, spec in cs_entries:
                uid = user_cache.get(uname)
                if not uid:
                    continue
                existing_a = await db.scalar(
                    select(AccountAssignment).where(
                        AccountAssignment.account_id == acct_id,
                        AccountAssignment.user_id == uid,
                        AccountAssignment.assignment_type == "cs",
                    )
                )
                if not existing_a:
                    db.add(AccountAssignment(
                        account_id=acct_id,
                        user_id=uid,
                        assignment_type="cs",
                        specialization=spec,
                        is_primary=False,
                    ))
                    created_assignments += 1

            # Team lead assignments
            for tl_col in ("TEAM LEAD 1", "TEAM LEAD 2"):
                tl_name = row.get(tl_col, "").strip()
                if not tl_name:
                    continue
                uid = user_cache.get(tl_name)
                if not uid:
                    continue
                existing_a = await db.scalar(
                    select(AccountAssignment).where(
                        AccountAssignment.account_id == acct_id,
                        AccountAssignment.user_id == uid,
                        AccountAssignment.assignment_type == "team_lead",
                    )
                )
                if not existing_a:
                    db.add(AccountAssignment(
                        account_id=acct_id,
                        user_id=uid,
                        assignment_type="team_lead",
                        is_primary=False,
                    ))
                    created_assignments += 1

            # Manager assignment
            mgr_name = row.get("TAM MANAGER", "").strip()
            if mgr_name:
                uid = user_cache.get(mgr_name)
                if uid:
                    existing_a = await db.scalar(
                        select(AccountAssignment).where(
                            AccountAssignment.account_id == acct_id,
                            AccountAssignment.user_id == uid,
                            AccountAssignment.assignment_type == "manager",
                        )
                    )
                    if not existing_a:
                        db.add(AccountAssignment(
                            account_id=acct_id,
                            user_id=uid,
                            assignment_type="manager",
                            is_primary=False,
                        ))
                        created_assignments += 1

                # Set manager_id on TAMs of this account
                for uname, spec in tam_entries:
                    tam_user = await db.scalar(
                        select(AdminUser).where(AdminUser.username == uname)
                    )
                    if tam_user and not tam_user.manager_id and uid:
                        tam_user.manager_id = uid

        await db.commit()
        log.info("Assignments: %d created", created_assignments)

        # ------------------------------------------------------------------
        # 4. TAM subscriptions -> AccountEntitlement
        # ------------------------------------------------------------------
        entitlements_csv = _read_csv("entitlements.csv")
        acronym_to_desc = {r["ACRONYM"]: r["DESCRIPTION"] for r in entitlements_csv}

        created_ent = 0
        for row in toolkit_rows:
            acct_num = row.get("ACCOUNT NUMBER", "").strip()
            acct_id = account_cache.get(acct_num)
            if not acct_id:
                continue
            subs = parse_subscriptions(row.get("TAM SUBSCRIPTIONS", ""))
            for sub in subs:
                ent_name = acronym_to_desc.get(sub["acronym"],
                                                f"TAM Services ({sub['acronym']})")
                prod_name = ACRONYM_TO_PRODUCT.get(sub["acronym"])
                prod_id = product_cache.get(prod_name) if prod_name else None
                try:
                    end_dt = date.fromisoformat(sub["end_date"])
                except ValueError:
                    end_dt = None
                existing_e = await db.scalar(
                    select(AccountEntitlement).where(
                        AccountEntitlement.account_id == acct_id,
                        AccountEntitlement.entitlement_name == ent_name,
                    )
                )
                if not existing_e:
                    db.add(AccountEntitlement(
                        account_id=acct_id,
                        entitlement_name=ent_name,
                        end_date=end_dt,
                        quantity=sub["quantity"],
                        product_id=prod_id,
                        sku=sub["acronym"],
                    ))
                    created_ent += 1

        await db.commit()
        log.info("Entitlements: %d created", created_ent)

        # ------------------------------------------------------------------
        # 5. Engagement
        # ------------------------------------------------------------------
        engagement_rows = _read_csv("engagement.csv")
        current_year = datetime.now().year

        created_eng = 0
        for row in engagement_rows:
            acct_num = row.get("ACCOUNT NUMBER", "").strip()
            acct_id = account_cache.get(acct_num)
            if not acct_id:
                continue
            cust_name = row.get("CUSTOMER NAME", "").strip()
            # Derive a customer_area from the account line name if it has
            # a parenthetical suffix like "(OCP)" or "(Platform)"
            area = None
            m = re.search(r"\(([^)]+)\)\s*$", cust_name)
            if m:
                area = m.group(1)

            def _clean(v):
                if not v:
                    return None
                v = v.strip()
                return None if (not v or v == "Not found!") else v

            py = _clean(row.get("LAST YEAR"))
            q1 = _clean(row.get("CY Q1"))
            q2 = _clean(row.get("CY Q2"))
            q3 = _clean(row.get("CY Q3"))
            q4 = _clean(row.get("CY Q4"))

            if not any([py, q1, q2, q3, q4]):
                continue

            existing_eng = await db.scalar(
                select(Engagement).where(
                    Engagement.account_id == acct_id,
                    Engagement.year == current_year,
                    Engagement.customer_area == area,
                )
            )
            if not existing_eng:
                db.add(Engagement(
                    account_id=acct_id,
                    customer_area=area,
                    py_engagement=py,
                    q1_engagement=q1,
                    q2_engagement=q2,
                    q3_engagement=q3,
                    q4_engagement=q4,
                    year=current_year,
                ))
                created_eng += 1

        await db.commit()
        log.info("Engagement: %d created", created_eng)

        # ------------------------------------------------------------------
        # 6. Action Plans (unified)
        # ------------------------------------------------------------------
        unified_rows = _read_csv("unified.csv")
        created_ap = 0
        skipped_ap = 0

        existing_ap_count = await db.scalar(text("SELECT COUNT(*) FROM action_plans"))
        if existing_ap_count and existing_ap_count > 0:
            log.info("Action plans: %d already exist, skipping import", existing_ap_count)
            unified_rows = []

        for row in unified_rows:
            acct_num = row.get("ACCOUNT NUMBER", "").strip()
            acct_id = account_cache.get(acct_num)
            if not acct_id:
                skipped_ap += 1
                continue

            def _g(key):
                v = row.get(key)
                return v.strip() if v else None

            desc = _g("INITIATIVE DESCRIPTION")
            if not desc:
                skipped_ap += 1
                continue

            start_year_raw = _g("START\nYEAR") or _g("START YEAR")
            close_year_raw = _g("CLOSE\nYEAR") or _g("CLOSE YEAR")
            start_qtr = _g("START\nQUARTER") or _g("START QUARTER")
            close_qtr = _g("CLOSE\nQUARTER") or _g("CLOSE QUARTER")

            try:
                start_year = int(start_year_raw) if start_year_raw else None
            except ValueError:
                start_year = None
            try:
                close_year = int(close_year_raw) if close_year_raw else None
            except ValueError:
                close_year = None

            db.add(ActionPlan(
                account_id=acct_id,
                description=desc,
                initiative_type=_g("INITIATIVE TYPE"),
                problem=_g("PROBLEM IDENTIFIED"),
                expected_outcome=_g("EXPECTED BUSINESS OUTCOME"),
                business_impact=_g("BUSINESS IMPACT"),
                customer_owner=_g("CUSTOMER OWNER"),
                customer_area=_g("CUSTOMER AREA"),
                contact_classification=_g("CONTACT CLASSIFICATION"),
                tam_name=_g("TAM NAME"),
                dee_name=_g("DEE NAME"),
                product=_g("PRODUCT"),
                status=_g("STATUS") or "Not started yet",
                start_year=start_year,
                start_quarter=start_qtr,
                close_year=close_year,
                close_quarter=close_qtr,
            ))
            created_ap += 1

            if created_ap % 1000 == 0:
                await db.commit()
                log.info("Action plans: %d created so far...", created_ap)

        await db.commit()
        log.info("Action plans: %d created, %d skipped", created_ap, skipped_ap)

        # ------------------------------------------------------------------
        # Summary
        # ------------------------------------------------------------------
        acct_count = await db.scalar(text("SELECT COUNT(*) FROM accounts"))
        user_count = await db.scalar(text("SELECT COUNT(*) FROM admin_users"))
        assign_count = await db.scalar(text("SELECT COUNT(*) FROM account_assignments"))
        ent_count = await db.scalar(text("SELECT COUNT(*) FROM account_entitlements"))
        eng_count = await db.scalar(text("SELECT COUNT(*) FROM engagements"))
        ap_count = await db.scalar(text("SELECT COUNT(*) FROM action_plans"))

        log.info("=== Import complete ===")
        log.info("  Users:        %d", user_count)
        log.info("  Accounts:     %d", acct_count)
        log.info("  Assignments:  %d", assign_count)
        log.info("  Entitlements: %d", ent_count)
        log.info("  Engagement:   %d", eng_count)
        log.info("  Action Plans: %d", ap_count)


if __name__ == "__main__":
    asyncio.run(run_import())
