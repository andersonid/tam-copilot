"""Factory for account-scoped CRUD routers.

Each sub-entity of Account (clusters, contacts, issues, etc.) follows the
same pattern: list/create/get/update/delete scoped to an account_id.
This module eliminates boilerplate by generating those endpoints.
"""

import logging
from typing import Any, Sequence, Type

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Account

logger = logging.getLogger("tam_copilot.crud")


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
        db: AsyncSession = Depends(get_db),
    ):
        stmt = select(model_class).order_by(order_col)
        if account_id is not None:
            stmt = stmt.where(model_class.account_id == account_id)
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
        db: AsyncSession = Depends(get_db),
    ):
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
    async def get_item(item_id: int, db: AsyncSession = Depends(get_db)):
        item = await db.get(model_class, item_id)
        if not item:
            raise HTTPException(404, f"{entity_name} not found")
        return item

    @router.patch(
        "/{item_id}",
        response_model=read_schema,
        summary=f"Update {entity_name}",
    )
    async def update_item(
        item_id: int, body: update_schema, db: AsyncSession = Depends(get_db),
    ):
        item = await db.get(model_class, item_id)
        if not item:
            raise HTTPException(404, f"{entity_name} not found")
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
    async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
        item = await db.get(model_class, item_id)
        if not item:
            raise HTTPException(404, f"{entity_name} not found")
        await db.delete(item)
        await db.commit()

    return router
