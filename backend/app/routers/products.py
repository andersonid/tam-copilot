import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Product
from ..schemas import ProductCreate, ProductRead

router = APIRouter(tags=["products"])


def _slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    return re.sub(r"[\s_]+", "-", s)


@router.get("/products", response_model=list[ProductRead])
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).order_by(Product.name))
    return result.scalars().all()


@router.post("/products", response_model=ProductRead, status_code=201)
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(Product).where(Product.name == data.name))
    if existing:
        raise HTTPException(400, "Product already exists")
    product = Product(name=data.name, slug=_slugify(data.name))
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product
