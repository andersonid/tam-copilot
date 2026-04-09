import re
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Customer
from ..schemas import CustomerCreate, CustomerRead

router = APIRouter(tags=["customers"])


def _slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    return re.sub(r"[\s_]+", "-", s)


@router.get("/customers", response_model=list[CustomerRead])
async def list_customers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).order_by(Customer.name))
    return result.scalars().all()


@router.post("/customers", response_model=CustomerRead, status_code=201)
async def create_customer(data: CustomerCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.scalar(select(Customer).where(Customer.name == data.name))
    if existing:
        raise HTTPException(400, "Customer already exists")
    customer = Customer(name=data.name, slug=_slugify(data.name))
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.get("/customers/{customer_id}", response_model=CustomerRead)
async def get_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    return customer


@router.put("/customers/{customer_id}", response_model=CustomerRead)
async def update_customer(customer_id: int, data: CustomerCreate, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    customer.name = data.name
    customer.slug = _slugify(data.name)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/customers/{customer_id}", status_code=204)
async def delete_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    await db.delete(customer)
    await db.commit()
