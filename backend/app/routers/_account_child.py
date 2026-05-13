"""Factory for account-scoped CRUD routers.

Each sub-entity of Account (clusters, contacts, issues, etc.) follows the
same pattern: list/create/get/update/delete scoped to an account_id.
This module eliminates boilerplate by generating those endpoints.
"""

import logging
from collections.abc import Sequence
from typing import Any, Type

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import false, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..auth import get_current_user
from ..models import Account, AdminUser
from ..access import accessible_account_ids, ensure_account_access

logger = logging.getLogger("tam_copilot.crud")


def _block_viewer_write(user: AdminUser) -> None:
    if user.role == "viewer":
        raise HTTPException(403, "Read-only profile")


def build_account_child_router(
    *,
    prefix: str,
    tag: str,
    model_class: Any,
    create_schema: Type[BaseModel],
    update_schema: Type[BaseModel],
    read_schema: Type[BaseModel],
    entity_name: str,
    default_order: Any = None,
    list_eager_options: Sequence[Any] = (),
) -> APIRouter:
    """Build a full CRUD router for an Account child entity.

    Args:
        prefix: URL prefix (e.g. "/action-plans").
        tag: OpenAPI tag name.
        model_class: SQLAlchemy model class.
        create_schema: Pydantic schema for creation.
        update_schema: Pydantic schema for updates.
        read_schema: Pydantic schema for reads.
        entity_name: Human-readable name for error messages.
        default_order: Column to order by (defaults to model's id desc).
        list_eager_options: Optional SQLAlchemy loader options applied to the list query
            (e.g. selectinload for relationships needed by read_schema).
    """
    router = APIRouter(prefix=prefix, tags=[tag])

    order_col = default_order if default_order is not None else model_class.id.desc()

    @router.get(
        "",
        response_model=list[read_schema],
        summary=f"List {entity_name}s",
        description=f"List all {entity_name}s, optionally filtered by account.",
    )
    async def list_items(
        account_id: int | None = Query(None, description="Filter by account"),
        user: AdminUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        allowed = await accessible_account_ids(db, user)
        stmt = select(model_class).order_by(order_col)
        if list_eager_options:
            stmt = stmt.options(*list_eager_options)
        if account_id is not None:
            await ensure_account_access(db, user, account_id)
            stmt = stmt.where(model_class.account_id == account_id)
        elif allowed is not None:
            if not allowed:
                stmt = stmt.where(false())
            else:
                stmt = stmt.where(model_class.account_id.in_(allowed))
        result = await db.execute(stmt)
        return result.scalars().all()

    @router.post(
        "",
        response_model=read_schema,
        status_code=201,
        summary=f"Create {entity_name}",
    )
    async def create_item(
        account_id: int = Query(..., description="Parent account ID"),
        body: create_schema = ...,
        user: AdminUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        _block_viewer_write(user)
        await ensure_account_access(db, user, account_id)
        account = await db.get(Account, account_id)
        if not account:
            raise HTTPException(404, "Account not found")
        item = model_class(account_id=account_id, **body.model_dump())
        db.add(item)
        await db.commit()
        await db.refresh(item)
        logger.info("%s.created | id=%d account_id=%d", entity_name, item.id, account_id)
        return item

    @router.get(
        "/{item_id}",
        response_model=read_schema,
        summary=f"Get {entity_name}",
    )
    async def get_item(
        item_id: int,
        user: AdminUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        item = await db.get(model_class, item_id)
        if not item:
            raise HTTPException(404, f"{entity_name} not found")
        await ensure_account_access(db, user, item.account_id)
        return item

    @router.patch(
        "/{item_id}",
        response_model=read_schema,
        summary=f"Update {entity_name}",
    )
    async def update_item(
        item_id: int,
        body: update_schema,
        user: AdminUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        _block_viewer_write(user)
        item = await db.get(model_class, item_id)
        if not item:
            raise HTTPException(404, f"{entity_name} not found")
        await ensure_account_access(db, user, item.account_id)
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(item, field, value)
        await db.commit()
        await db.refresh(item)
        return item

    @router.delete(
        "/{item_id}",
        status_code=204,
        summary=f"Delete {entity_name}",
    )
    async def delete_item(
        item_id: int,
        user: AdminUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        _block_viewer_write(user)
        item = await db.get(model_class, item_id)
        if not item:
            raise HTTPException(404, f"{entity_name} not found")
        await ensure_account_access(db, user, item.account_id)
        await db.delete(item)
        await db.commit()

    return router
