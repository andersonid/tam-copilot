import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Product, DocumentType, LLMProvider, AdminUser
from .config import settings
from .crypto import encrypt_api_key
from .auth import hash_password


def _slugify(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    return re.sub(r"[\s_]+", "-", s)


PRODUCTS = [
    "OpenShift",
    "OpenShift Virtualization",
    "Ansible Automation Platform",
    "RHEL",
    "Advanced Cluster Management",
    "Quay",
    "OpenShift AI",
]

DOCUMENT_TYPES = [
    ("RCA", "#CC0000"),
    ("Meeting Notes", "#0066CC"),
    ("Action Plan", "#EC7A08"),
    ("TAM Report", "#3E8635"),
    ("Architecture Review", "#6753AC"),
    ("Migration Guide", "#009596"),
    ("KCS Article", "#8B0000"),
    ("Project Schedule", "#4394E5"),
    ("Assessment", "#A855F7"),
]


async def seed_data(db: AsyncSession) -> None:
    for name in PRODUCTS:
        exists = await db.scalar(select(Product).where(Product.name == name))
        if not exists:
            db.add(Product(name=name, slug=_slugify(name)))

    for name, color in DOCUMENT_TYPES:
        exists = await db.scalar(select(DocumentType).where(DocumentType.name == name))
        if not exists:
            db.add(DocumentType(name=name, slug=_slugify(name), color=color))

    exists = await db.scalar(select(LLMProvider).where(LLMProvider.name == settings.default_provider_name))
    if not exists and settings.default_provider_api_key:
        db.add(LLMProvider(
            name=settings.default_provider_name,
            provider_type=settings.default_provider_type,
            base_url=settings.default_provider_base_url,
            api_key_encrypted=encrypt_api_key(settings.default_provider_api_key),
            default_model=settings.default_provider_model,
            is_default=True,
            is_active=True,
        ))

    admin = await db.scalar(select(AdminUser).where(AdminUser.username == "anobre"))
    if not admin:
        db.add(AdminUser(username="anobre", password_hash=hash_password("123456")))

    await db.commit()
