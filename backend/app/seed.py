import re
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Product, DocumentType, LLMProvider, AdminUser, Vertical, Segment
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


VERTICALS = [
    "Commercial Private",
    "Commercial Public",
    "Enterprise",
    "Government",
    "TME",
]

SEGMENTS = [
    "Education",
    "Energy",
    "FSI",
    "Government",
    "Healthcare",
    "Insurance",
    "Logistics",
    "Manufacturing",
    "Retail",
    "Services",
    "Technology",
    "Telecom",
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

    for name in VERTICALS:
        exists = await db.scalar(select(Vertical).where(Vertical.name == name))
        if not exists:
            db.add(Vertical(name=name, is_active=True))

    for name in SEGMENTS:
        exists = await db.scalar(select(Segment).where(Segment.name == name))
        if not exists:
            db.add(Segment(name=name, is_active=True))

    # Dev personas (password 123456): manager + TAM on that manager's team.
    # Team lead is not a user role — use AccountAssignment.assignment_type == "team_lead" per account.
    pw_dev = hash_password("123456")

    theboss = await db.scalar(select(AdminUser).where(AdminUser.username == "theboss"))
    if not theboss:
        theboss = AdminUser(
            username="theboss",
            password_hash=pw_dev,
            role="manager",
            is_active=True,
            manager_id=None,
            full_name="The Boss",
            email="theboss@redhat.com",
        )
        db.add(theboss)
        await db.flush()
    else:
        theboss.role = "manager"
        theboss.password_hash = pw_dev
        theboss.is_active = True
        theboss.manager_id = None
        theboss.full_name = "The Boss"
        theboss.email = "theboss@redhat.com"

    anobre_user = await db.scalar(select(AdminUser).where(AdminUser.username == "anobre"))
    if not anobre_user:
        db.add(
            AdminUser(
                username="anobre",
                password_hash=pw_dev,
                role="tam",
                is_active=True,
                manager_id=theboss.id,
                full_name="Anderson Nobre",
                email="anobre@redhat.com",
            )
        )
    else:
        anobre_user.role = "tam"
        anobre_user.password_hash = pw_dev
        anobre_user.is_active = True
        anobre_user.manager_id = theboss.id
        anobre_user.full_name = "Anderson Nobre"
        anobre_user.email = "anobre@redhat.com"

    # Platform admin (dev password 123456) — access to /admin/users, customers, LLM providers.
    root_admin = await db.scalar(select(AdminUser).where(AdminUser.username == "admin"))
    if not root_admin:
        db.add(
            AdminUser(
                username="admin",
                password_hash=pw_dev,
                role="admin",
                is_active=True,
                manager_id=None,
                full_name="Platform Admin",
                email="admin@localhost",
            )
        )
    else:
        root_admin.role = "admin"
        root_admin.password_hash = pw_dev
        root_admin.is_active = True
        root_admin.manager_id = None
        root_admin.full_name = "Platform Admin"
        root_admin.email = "admin@localhost"

    await db.commit()
