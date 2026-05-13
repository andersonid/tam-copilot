"""TAM Report compiler: aggregates account data into a structured dict
suitable for rendering via the base.html.j2 template.

The compiled report includes: account summary, cluster health, risks,
action plan progress, touchpoints, entitlements, and engagement data.
"""

import logging
from datetime import date, datetime

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import (
    Account, AccountCluster, AccountEntitlement, AccountContact,
    AccountIssue, ActionPlan, Touchpoint, Risk, Engagement,
    ProductLifecycle,
)

logger = logging.getLogger("tam_copilot.report_compiler")


async def compile_tam_report(db: AsyncSession, account_id: int) -> dict:
    """Build a structured report dict from all account data.

    Returns a dict compatible with the base.html.j2 template renderer,
    populating title, subtitle, meta, and sections.
    """
    account = await db.scalar(select(Account).where(Account.id == account_id))
    if not account:
        raise ValueError(f"Account {account_id} not found")

    clusters = (await db.execute(
        select(AccountCluster).where(AccountCluster.account_id == account_id)
    )).scalars().all()

    risks = (await db.execute(
        select(Risk).where(Risk.account_id == account_id).order_by(Risk.status)
    )).scalars().all()

    action_plans = (await db.execute(
        select(ActionPlan).where(ActionPlan.account_id == account_id).order_by(ActionPlan.sort_order)
    )).scalars().all()

    touchpoints = (await db.execute(
        select(Touchpoint).where(Touchpoint.account_id == account_id)
        .order_by(Touchpoint.touchpoint_date.desc()).limit(10)
    )).scalars().all()

    entitlements = (await db.execute(
        select(AccountEntitlement).where(AccountEntitlement.account_id == account_id)
    )).scalars().all()

    engagements = (await db.execute(
        select(Engagement).where(Engagement.account_id == account_id)
        .order_by(Engagement.year.desc())
    )).scalars().all()

    lifecycle = (await db.execute(
        select(ProductLifecycle).where(ProductLifecycle.account_id == account_id)
    )).scalars().all()

    issues = (await db.execute(
        select(AccountIssue).where(AccountIssue.account_id == account_id)
    )).scalars().all()

    contacts = (await db.execute(
        select(AccountContact).where(
            AccountContact.account_id == account_id,
            AccountContact.team == "customer",
        )
    )).scalars().all()

    today = date.today()
    sections: list[dict] = []

    # -- Account Summary -------------------------------------------------------
    sections.append({
        "type": "part_divider",
        "tag": "01",
        "heading": "Account Overview",
    })
    sections.append({
        "type": "key_value_list",
        "heading": "Account Details",
        "items": [
            {"key": "Account Name", "value": account.name},
            {"key": "Account Number", "value": account.account_number},
            {"key": "Region", "value": account.region or "—"},
            {"key": "Country", "value": account.country or "—"},
            {"key": "TAM Type", "value": account.tam_type or "—"},
            {"key": "Report Date", "value": today.isoformat()},
        ],
    })

    # -- Key Contacts ----------------------------------------------------------
    if contacts:
        tam_contacts = [c for c in contacts if c.is_tam_contact]
        admin_contacts = [c for c in contacts if c.is_org_admin and not c.is_tam_contact]
        other_contacts = [c for c in contacts if not c.is_tam_contact and not c.is_org_admin]

        contact_items = []
        for group_name, group in [("TAM Contacts", tam_contacts), ("Org Admins", admin_contacts), ("Other", other_contacts)]:
            for c in group[:5]:
                contact_items.append({
                    "name": c.name,
                    "role": f"{c.title or ''} — {group_name}".strip(" — "),
                    "org": "customer",
                })
        if contact_items:
            sections.append({
                "type": "stakeholders",
                "heading": "Key Contacts",
                "items": contact_items,
            })

    # -- Cluster Health --------------------------------------------------------
    if clusters:
        sections.append({
            "type": "part_divider",
            "tag": "02",
            "heading": "Cluster Health",
        })
        sections.append({
            "type": "metric_cards",
            "items": [
                {"value": str(len(clusters)), "label": "Total Clusters"},
                {"value": str(sum(1 for c in clusters if c.health_state == "healthy")), "label": "Healthy"},
                {"value": str(sum(1 for c in clusters if c.health_state != "healthy")), "label": "Unhealthy / Warning"},
                {"value": str(sum(c.critical_alerts or 0 for c in clusters)), "label": "Critical Alerts"},
            ],
        })
        cluster_rows = []
        for c in clusters:
            cluster_rows.append([
                c.display_name or c.external_cluster_id[:12],
                c.openshift_version or "—",
                c.health_state or "unknown",
                str(c.compute_nodes or "—"),
                str(c.vcpu_total or "—"),
                c.cloud_provider or "—",
                c.upgrade_available or "—",
            ])
        sections.append({
            "type": "data_table",
            "heading": "Cluster Details",
            "headers": ["Name", "OCP Version", "Health", "Workers", "vCPU", "Provider", "Upgrade"],
            "rows": cluster_rows,
        })

    # -- Entitlements ----------------------------------------------------------
    if entitlements:
        sections.append({
            "type": "part_divider",
            "tag": "03",
            "heading": "Entitlements",
        })
        expiring = [e for e in entitlements if e.end_date and (e.end_date - today).days <= 90 and (e.end_date - today).days >= 0]
        expired = [e for e in entitlements if e.end_date and e.end_date < today]
        if expiring or expired:
            msgs = []
            if expired:
                msgs.append(f"{len(expired)} expired entitlement(s)")
            if expiring:
                msgs.append(f"{len(expiring)} expiring within 90 days")
            sections.append({
                "type": "warning_card",
                "heading": "Entitlement Alerts",
                "content": ". ".join(msgs) + ".",
            })
        ent_rows = [[e.entitlement_name, e.sku or "—", e.support_level or "—",
                      str(e.start_date or "—"), str(e.end_date or "—"), str(e.quantity or 1)]
                     for e in entitlements[:20]]
        sections.append({
            "type": "data_table",
            "heading": "Active Entitlements",
            "headers": ["Name", "SKU", "Support Level", "Start", "End", "Qty"],
            "rows": ent_rows,
        })

    # -- Product Lifecycle Risks -----------------------------------------------
    if lifecycle:
        at_risk = [lc for lc in lifecycle if lc.current_phase and "end" in lc.current_phase.lower()]
        maintenance = [lc for lc in lifecycle if lc.current_phase and "maintenance" in lc.current_phase.lower()]
        if at_risk or maintenance:
            sections.append({
                "type": "part_divider",
                "tag": "04",
                "heading": "Lifecycle Risks",
            })
            if at_risk:
                sections.append({
                    "type": "danger_card",
                    "heading": "End of Life Products",
                    "content": ", ".join(f"{lc.product_name} {lc.version}" for lc in at_risk),
                })
            if maintenance:
                sections.append({
                    "type": "warning_card",
                    "heading": "Maintenance Phase Products",
                    "content": ", ".join(f"{lc.product_name} {lc.version}" for lc in maintenance),
                })

    # -- Action Plan -----------------------------------------------------------
    if action_plans:
        tag = "05" if lifecycle else "04"
        sections.append({
            "type": "part_divider",
            "tag": tag,
            "heading": "Action Plan",
        })
        total = len(action_plans)
        done = sum(1 for a in action_plans if a.status in ("Done", "Completed"))
        blocked = sum(1 for a in action_plans if a.status == "Blocked")
        sections.append({
            "type": "metric_cards",
            "items": [
                {"value": str(total), "label": "Total Initiatives"},
                {"value": str(done), "label": "Completed"},
                {"value": str(total - done), "label": "In Progress"},
                {"value": str(blocked), "label": "Blocked", "description": "Needs attention" if blocked else ""},
            ],
        })
        ap_rows = []
        for a in action_plans:
            ap_rows.append([
                a.description[:60] + ("..." if len(a.description) > 60 else ""),
                a.status,
                a.product or "—",
                a.business_impact or "—",
                f"{a.start_quarter or ''}/{a.start_year or ''}",
            ])
        sections.append({
            "type": "data_table",
            "heading": "Initiative Details",
            "headers": ["Initiative", "Status", "Product", "Impact", "Start"],
            "rows": ap_rows,
        })

    # -- Risks -----------------------------------------------------------------
    open_risks = [r for r in risks if r.status == "Open"]
    if open_risks:
        sections.append({
            "type": "part_divider",
            "tag": "06",
            "heading": "Active Risks",
        })
        risk_rows = [[r.short_name, r.probability or "—", r.impact or "—",
                       r.customer_area or "—", r.description[:80] if r.description else "—"]
                      for r in open_risks]
        sections.append({
            "type": "data_table",
            "heading": "Risk Register",
            "headers": ["Risk", "Probability", "Impact", "Area", "Description"],
            "rows": risk_rows,
        })

    # -- Issues ----------------------------------------------------------------
    open_issues = [i for i in issues if i.status not in ("Closed", "Done", "Resolved")]
    if open_issues:
        sections.append({
            "type": "part_divider",
            "tag": "07",
            "heading": "Open Issues",
        })
        issue_rows = [[i.key, i.summary[:60], i.status, i.priority or "—", i.assignee or "—"]
                      for i in open_issues[:15]]
        sections.append({
            "type": "data_table",
            "heading": "Issues Tracker",
            "headers": ["Key", "Summary", "Status", "Priority", "Assignee"],
            "rows": issue_rows,
        })

    # -- Touchpoints -----------------------------------------------------------
    if touchpoints:
        sections.append({
            "type": "part_divider",
            "tag": "08",
            "heading": "Recent Touchpoints",
        })
        sections.append({
            "type": "timeline",
            "items": [
                {
                    "date": str(t.touchpoint_date),
                    "title": t.customer_area or "Meeting",
                    "description": t.topics or "—",
                }
                for t in touchpoints[:8]
            ],
        })

    # -- Engagement ------------------------------------------------------------
    if engagements:
        sections.append({
            "type": "part_divider",
            "tag": "09",
            "heading": "Engagement Tracking",
        })
        eng_rows = []
        for e in engagements[:10]:
            eng_rows.append([
                e.customer_area, str(e.year),
                e.q1_engagement or "—", e.q2_engagement or "—",
                e.q3_engagement or "—", e.q4_engagement or "—",
            ])
        sections.append({
            "type": "data_table",
            "heading": "Engagement by Quarter",
            "headers": ["Area", "Year", "Q1", "Q2", "Q3", "Q4"],
            "rows": eng_rows,
        })

    report = {
        "title": f"TAM Report — {account.name}",
        "subtitle": f"Service report generated on {today.isoformat()} for account {account.account_number}",
        "meta": {
            "customer": account.name,
            "doc_type_label": "TAM REPORT",
            "date": today.isoformat(),
        },
        "sections": sections,
    }

    logger.info(
        "report.compiled | account=%s sections=%d",
        account.account_number, len(sections),
    )
    return report
