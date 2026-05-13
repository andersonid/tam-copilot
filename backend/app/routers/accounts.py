"""Account management endpoints."""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from ..access import accessible_account_ids, ensure_account_access
from ..auth import get_current_user, require_role
from ..database import get_db
from ..models import Account, AccountAssignment, AccountEntitlement, AdminUser, Product, Segment, Vertical
from ..schemas import (
    AccountAssignmentCreate,
    AccountAssignmentRead,
    AccountCreate,
    AccountListRead,
    AccountRead,
    AccountUpdate,
    ProductMiniRead,
    SegmentRead,
    SubscriptionCoverageAssignmentOut,
    SubscriptionCoverageEntitlementOut,
    SubscriptionCoverageProductBucket,
    SubscriptionCoverageResponse,
    VerticalRead,
)

logger = logging.getLogger("tam_copilot.accounts")

router = APIRouter(prefix="/accounts", tags=["Accounts"])


def _product_mini(p: Product | None) -> ProductMiniRead | None:
    if not p:
        return None
    return ProductMiniRead.model_validate(p)


def _assignment_to_read(a: AccountAssignment) -> AccountAssignmentRead:
    return AccountAssignmentRead(
        id=a.id,
        account_id=a.account_id,
        user_id=a.user_id,
        username=a.user.username if a.user else None,
        full_name=a.user.full_name if a.user else None,
        assignment_type=a.assignment_type,
        specialization=a.specialization,
        is_primary=a.is_primary,
        assigned_at=a.assigned_at,
        product_id=a.product_id,
        product=_product_mini(getattr(a, "catalog_product", None)),
    )


def _viewer_block(user: AdminUser) -> None:
    if user.role == "viewer":
        raise HTTPException(403, "Perfil somente leitura")


class HydraAccountResult(BaseModel):
    account_number: str
    name: str
    country: str | None = None
    tam_name: str | None = None
    support_level: str | None = None
    already_imported: bool = False


def _get_hydra_client():
    from ..main import _sync_service
    if _sync_service is None or _sync_service.hydra is None:
        raise HTTPException(503, "Hydra integration not configured — set HYDRA_OFFLINE_TOKEN")
    return _sync_service.hydra


def _parse_hydra_account(raw: dict) -> dict[str, Any]:
    return {
        "account_number": str(raw.get("accountNumber", raw.get("account_number", ""))),
        "name": raw.get("name", raw.get("company", "")),
        "country": raw.get("country", None),
        "tam_name": raw.get("tamName", raw.get("tam_name", None)),
        "support_level": raw.get("supportLevel", raw.get("support_level", None)),
    }


@router.get(
    "/search-hydra",
    response_model=list[HydraAccountResult],
    summary="Search Red Hat accounts via Hydra API",
)
async def search_hydra_accounts(
    q: str = Query(..., min_length=2, description="Account name or number"),
    db: AsyncSession = Depends(get_db),
):
    hydra = _get_hydra_client()
    q = q.strip()
    results: list[dict[str, Any]] = []

    if q.isdigit():
        direct = await hydra.get_account(q)
        if isinstance(direct, dict) and not direct.get("error"):
            results = [_parse_hydra_account(direct)]
    else:
        raw_list = await hydra.search_accounts_by_name(q, rows=10)
        results = [_parse_hydra_account(r) for r in raw_list]

    if not results:
        return []

    numbers = [r["account_number"] for r in results if r["account_number"]]
    existing: set[str] = set()
    if numbers:
        rows = await db.execute(
            select(Account.account_number).where(Account.account_number.in_(numbers))
        )
        existing = {r[0] for r in rows.fetchall()}

    return [
        HydraAccountResult(**r, already_imported=r["account_number"] in existing)
        for r in results
        if r["account_number"]
    ]


def _summarize_assignments(assignments: list[AccountAssignment]) -> tuple[str, str]:
    """Return (tam_summary, team_lead_summary) strings."""
    tams: list[str] = []
    tls: list[str] = []
    for a in assignments:
        u = a.user
        label = (u.full_name or u.username) if u else f"user#{a.user_id}"
        spec = f" ({a.specialization})" if a.specialization else ""
        if a.assignment_type == "team_lead":
            tls.append(f"{label}{spec}")
        elif a.assignment_type == "tam":
            tams.append(f"{label}{spec}")
    return ", ".join(tams) if tams else "—", ", ".join(tls) if tls else "—"


async def _list_accounts_for_user(
    db: AsyncSession,
    user: AdminUser,
    tam_user_id: int | None,
    is_active: bool | None,
) -> list[AccountListRead]:
    allowed = await accessible_account_ids(db, user)
    stmt = (
        select(Account)
        .options(
            selectinload(Account.assignments).joinedload(AccountAssignment.user),
            selectinload(Account.assignments).joinedload(AccountAssignment.catalog_product),
            joinedload(Account.vertical_ref),
            joinedload(Account.segment_ref),
        )
        .order_by(Account.name)
    )
    if allowed is not None:
        if not allowed:
            return []
        stmt = stmt.where(Account.id.in_(allowed))
    if tam_user_id is not None:
        sub = (
            select(AccountAssignment.account_id)
            .where(AccountAssignment.user_id == tam_user_id)
            .union(select(Account.id).where(Account.tam_user_id == tam_user_id))
        )
        stmt = stmt.where(Account.id.in_(sub))
    if is_active is not None:
        stmt = stmt.where(Account.is_active == is_active)
    result = await db.execute(stmt)
    accounts = result.unique().scalars().all()
    out: list[AccountListRead] = []
    for a in accounts:
        tsum, tlsum = _summarize_assignments(list(a.assignments))
        out.append(
            AccountListRead(
                id=a.id,
                name=a.name,
                account_number=a.account_number,
                region=a.region,
                country=a.country,
                tam_type=a.tam_type,
                is_active=a.is_active,
                vertical_id=a.vertical_id,
                segment_id=a.segment_id,
                vertical_name=a.vertical_ref.name if a.vertical_ref else None,
                segment_name=a.segment_ref.name if a.segment_ref else None,
                tam_user_id=a.tam_user_id,
                assignments_summary=tsum,
                team_leads_summary=tlsum,
                created_at=a.created_at,
            )
        )
    return out


@router.get(
    "",
    response_model=list[AccountListRead],
    summary="List accounts",
)
async def list_accounts(
    tam_user_id: int | None = Query(None, description="Filter by TAM user"),
    is_active: bool | None = Query(None),
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _list_accounts_for_user(db, user, tam_user_id, is_active)


@router.post(
    "",
    response_model=AccountRead,
    status_code=201,
    summary="Create account",
)
async def create_account(
    body: AccountCreate,
    user: AdminUser = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    _viewer_block(user)
    existing = await db.scalar(
        select(Account).where(Account.account_number == body.account_number)
    )
    if existing:
        raise HTTPException(409, f"Account {body.account_number} already exists")
    data = body.model_dump()
    tam_uid = data.pop("tam_user_id", None)
    account = Account(**data)
    if tam_uid is not None:
        account.tam_user_id = tam_uid
    db.add(account)
    await db.flush()
    if tam_uid is not None:
        db.add(
            AccountAssignment(
                account_id=account.id,
                user_id=tam_uid,
                assignment_type="tam",
                specialization=None,
                is_primary=True,
                assigned_by_id=user.id,
            )
        )
    await db.commit()
    await db.refresh(account)
    stmt = (
        select(Account)
        .options(
            joinedload(Account.vertical_ref),
            joinedload(Account.segment_ref),
            selectinload(Account.assignments).joinedload(AccountAssignment.user),
            selectinload(Account.assignments).joinedload(AccountAssignment.catalog_product),
        )
        .where(Account.id == account.id)
    )
    account = (await db.execute(stmt)).unique().scalar_one()
    logger.info("account.created | id=%d number=%s", account.id, account.account_number)
    return _account_to_read(account)


def _account_to_read(account: Account) -> AccountRead:
    assigns = [_assignment_to_read(a) for a in account.assignments]
    return AccountRead(
        id=account.id,
        name=account.name,
        account_number=account.account_number,
        region=account.region,
        country=account.country,
        vertical_id=account.vertical_id,
        segment_id=account.segment_id,
        vertical=VerticalRead.model_validate(account.vertical_ref) if account.vertical_ref else None,
        segment=SegmentRead.model_validate(account.segment_ref) if account.segment_ref else None,
        tam_user_id=account.tam_user_id,
        tam_type=account.tam_type,
        notes=account.notes,
        is_active=account.is_active,
        created_at=account.created_at,
        updated_at=account.updated_at,
        assignments=assigns,
    )


@router.get(
    "/{account_id}",
    response_model=AccountRead,
    summary="Get account details",
)
async def get_account(
    account_id: int,
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_account_access(db, user, account_id)
    stmt = (
        select(Account)
        .options(
            joinedload(Account.vertical_ref),
            joinedload(Account.segment_ref),
            selectinload(Account.assignments).joinedload(AccountAssignment.user),
            selectinload(Account.assignments).joinedload(AccountAssignment.catalog_product),
        )
        .where(Account.id == account_id)
    )
    account = (await db.execute(stmt)).unique().scalar_one_or_none()
    if not account:
        raise HTTPException(404, "Account not found")
    return _account_to_read(account)


@router.get(
    "/{account_id}/subscription-coverage",
    response_model=SubscriptionCoverageResponse,
    summary="Assignments and entitlements grouped by catalog product",
)
async def subscription_coverage(
    account_id: int,
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_account_access(db, user, account_id)
    acc = await db.get(Account, account_id)
    if not acc:
        raise HTTPException(404, "Account not found")

    assigns = (
        await db.execute(
            select(AccountAssignment)
            .options(
                joinedload(AccountAssignment.user),
                joinedload(AccountAssignment.catalog_product),
            )
            .where(AccountAssignment.account_id == account_id)
        )
    ).scalars().unique().all()

    ents = (
        await db.execute(
            select(AccountEntitlement)
            .options(joinedload(AccountEntitlement.catalog_product))
            .where(AccountEntitlement.account_id == account_id)
        )
    ).scalars().unique().all()

    keys: set[int | None] = set()
    for a in assigns:
        keys.add(a.product_id)
    for e in ents:
        keys.add(e.product_id)

    non_null = {k for k in keys if k is not None}
    prod_names: dict[int, str] = {}
    if non_null:
        prods = (await db.execute(select(Product).where(Product.id.in_(non_null)))).scalars().all()
        prod_names = {p.id: p.name for p in prods}

    ordered = sorted(non_null, key=lambda i: (prod_names.get(i, "").lower(), i))
    if None in keys:
        ordered.append(None)

    buckets: list[SubscriptionCoverageProductBucket] = []
    for pid in ordered:
        pname = prod_names.get(pid) if pid is not None else None
        ass_out = [
            SubscriptionCoverageAssignmentOut(
                id=a.id,
                user_id=a.user_id,
                username=a.user.username if a.user else None,
                full_name=a.user.full_name if a.user else None,
                assignment_type=a.assignment_type,
                specialization=a.specialization,
                product_id=a.product_id,
                product_name=a.catalog_product.name if a.catalog_product else None,
            )
            for a in assigns
            if a.product_id == pid
        ]
        ent_out = [
            SubscriptionCoverageEntitlementOut(
                id=e.id,
                entitlement_name=e.entitlement_name,
                sku=e.sku,
                product_id=e.product_id,
                product_name=e.catalog_product.name if e.catalog_product else None,
                support_level=e.support_level,
                end_date=e.end_date,
            )
            for e in ents
            if e.product_id == pid
        ]
        buckets.append(
            SubscriptionCoverageProductBucket(
                product_id=pid,
                product_name=pname,
                assignments=ass_out,
                entitlements=ent_out,
            )
        )

    return SubscriptionCoverageResponse(
        account_id=acc.id,
        account_number=acc.account_number,
        account_name=acc.name,
        buckets=buckets,
    )


@router.patch(
    "/{account_id}",
    response_model=AccountRead,
    summary="Update account",
)
async def update_account(
    account_id: int,
    body: AccountUpdate,
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _viewer_block(user)
    await ensure_account_access(db, user, account_id)
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    old_tam = account.tam_user_id
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    new_tam = account.tam_user_id
    if new_tam != old_tam and new_tam is not None:
        existing = await db.scalar(
            select(AccountAssignment).where(
                AccountAssignment.account_id == account_id,
                AccountAssignment.user_id == new_tam,
                AccountAssignment.assignment_type == "tam",
            )
        )
        if not existing:
            db.add(
                AccountAssignment(
                    account_id=account_id,
                    user_id=new_tam,
                    assignment_type="tam",
                    is_primary=True,
                    assigned_by_id=user.id,
                )
            )
    await db.commit()
    stmt = (
        select(Account)
        .options(
            joinedload(Account.vertical_ref),
            joinedload(Account.segment_ref),
            selectinload(Account.assignments).joinedload(AccountAssignment.user),
            selectinload(Account.assignments).joinedload(AccountAssignment.catalog_product),
        )
        .where(Account.id == account_id)
    )
    account = (await db.execute(stmt)).unique().scalar_one()
    return _account_to_read(account)


@router.delete(
    "/{account_id}",
    status_code=204,
    summary="Delete account",
)
async def delete_account(
    account_id: int,
    caller: AdminUser = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    await ensure_account_access(db, caller, account_id)
    account = await db.get(Account, account_id)
    if not account:
        raise HTTPException(404, "Account not found")
    await db.delete(account)
    await db.commit()


@router.get(
    "/{account_id}/assignments",
    response_model=list[AccountAssignmentRead],
    summary="List account assignments",
)
async def list_assignments(
    account_id: int,
    user: AdminUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_account_access(db, user, account_id)
    stmt = (
        select(AccountAssignment)
        .options(
            joinedload(AccountAssignment.user),
            joinedload(AccountAssignment.catalog_product),
        )
        .where(AccountAssignment.account_id == account_id)
    )
    rows = (await db.execute(stmt)).scalars().unique().all()
    return [_assignment_to_read(a) for a in rows]


@router.post(
    "/{account_id}/assignments",
    response_model=AccountAssignmentRead,
    status_code=201,
    summary="Add assignment",
)
async def add_assignment(
    account_id: int,
    body: AccountAssignmentCreate,
    user: AdminUser = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    _viewer_block(user)
    await ensure_account_access(db, user, account_id)
    acc = await db.get(Account, account_id)
    if not acc:
        raise HTTPException(404, "Account not found")
    target = await db.get(AdminUser, body.user_id)
    if not target:
        raise HTTPException(404, "User not found")
    if body.product_id is not None:
        prod = await db.get(Product, body.product_id)
        if not prod:
            raise HTTPException(404, "Product not found")
    row = AccountAssignment(
        account_id=account_id,
        user_id=body.user_id,
        assignment_type=body.assignment_type,
        specialization=body.specialization,
        is_primary=body.is_primary,
        assigned_by_id=user.id,
        product_id=body.product_id,
    )
    db.add(row)
    if body.assignment_type == "tam" and acc.tam_user_id is None:
        acc.tam_user_id = body.user_id
    await db.commit()
    await db.refresh(row)
    row = (
        await db.execute(
            select(AccountAssignment)
            .options(
                joinedload(AccountAssignment.user),
                joinedload(AccountAssignment.catalog_product),
            )
            .where(AccountAssignment.id == row.id)
        )
    ).scalar_one()
    return _assignment_to_read(row)


@router.delete(
    "/{account_id}/assignments/{assignment_id}",
    status_code=204,
    summary="Remove assignment",
)
async def remove_assignment(
    account_id: int,
    assignment_id: int,
    user: AdminUser = Depends(require_role("admin", "manager")),
    db: AsyncSession = Depends(get_db),
):
    _viewer_block(user)
    await ensure_account_access(db, user, account_id)
    row = await db.get(AccountAssignment, assignment_id)
    if not row or row.account_id != account_id:
        raise HTTPException(404, "Assignment not found")
    acc = await db.get(Account, account_id)
    if acc and acc.tam_user_id == row.user_id and row.assignment_type == "tam":
        acc.tam_user_id = None
    await db.delete(row)
    await db.commit()
