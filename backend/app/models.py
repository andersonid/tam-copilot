"""SQLAlchemy ORM models for TAM-Copilot platform.

Covers user management, account management, cluster telemetry, support cases,
action plans, risks, touchpoints, engagement tracking, NPS surveys, issues,
entitlements, product lifecycle, and content generation (guides).
"""

import secrets
from datetime import date, datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Date,
    DateTime,
    Boolean,
    Float,
    LargeBinary,
    ForeignKey,
    Table,
    func,
)
from sqlalchemy.orm import relationship

from .database import Base


def _generate_token() -> str:
    return secrets.token_urlsafe(24)


# ---------------------------------------------------------------------------
# Association tables
# ---------------------------------------------------------------------------

guide_tags = Table(
    "guide_tags",
    Base.metadata,
    Column("guide_id", Integer, ForeignKey("guides.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


# ---------------------------------------------------------------------------
# User (evolved from AdminUser)
# ---------------------------------------------------------------------------

class AdminUser(Base):
    """Platform user — TAM, manager, or admin.

    Keeps the original table name 'admin_users' for backward compatibility
    with existing migrations and data.  The role field controls access level.
    """

    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    full_name = Column(String(255), nullable=True)
    sso_username = Column(String(100), nullable=True)
    role = Column(String(20), nullable=False, default="tam")  # admin | manager | tam | viewer
    tam_type = Column(String(50), nullable=True)  # Platform, Middleware, AI, Automation, OpenShift, etc.
    certifications_json = Column(Text, nullable=True)  # JSON list of {name, date, expiry}
    skills_tags = Column(Text, nullable=True)  # comma-separated specialties
    service_days_config_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    accounts = relationship("Account", back_populates="tam_user")


# ---------------------------------------------------------------------------
# Account (replaces Customer as the central entity)
# ---------------------------------------------------------------------------

class Account(Base):
    """Customer account managed by a TAM — central entity of the platform."""

    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    account_number = Column(String(50), nullable=False, unique=True, index=True)
    region = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    tam_user_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    tam_type = Column(String(50), nullable=True)
    service_days_json = Column(Text, nullable=True)  # JSON with Mon-Fri service config
    purchased_products_json = Column(Text, nullable=True)  # JSON list of product names
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    tam_user = relationship("AdminUser", back_populates="accounts")
    clusters = relationship("AccountCluster", back_populates="account", cascade="all, delete-orphan")
    entitlements = relationship("AccountEntitlement", back_populates="account", cascade="all, delete-orphan")
    contacts = relationship("AccountContact", back_populates="account", cascade="all, delete-orphan")
    issues = relationship("AccountIssue", back_populates="account", cascade="all, delete-orphan")
    action_plans = relationship("ActionPlan", back_populates="account", cascade="all, delete-orphan")
    touchpoints = relationship("Touchpoint", back_populates="account", cascade="all, delete-orphan")
    risks = relationship("Risk", back_populates="account", cascade="all, delete-orphan")
    engagements = relationship("Engagement", back_populates="account", cascade="all, delete-orphan")
    nps_surveys = relationship("NpsSurvey", back_populates="account", cascade="all, delete-orphan")
    lifecycle_entries = relationship("ProductLifecycle", back_populates="account", cascade="all, delete-orphan")
    guides = relationship("Guide", back_populates="account")


# ---------------------------------------------------------------------------
# AccountCluster (OCM telemetry cache)
# ---------------------------------------------------------------------------

class AccountCluster(Base):
    """OpenShift cluster linked to an account — cached from OCM API."""

    __tablename__ = "account_clusters"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    external_cluster_id = Column(String(100), nullable=False)
    display_name = Column(String(255), nullable=True)
    status = Column(String(50), nullable=True)
    console_url = Column(String(500), nullable=True)
    openshift_version = Column(String(50), nullable=True)
    lifecycle_phase = Column(String(100), nullable=True)
    master_nodes = Column(Integer, nullable=True)
    compute_nodes = Column(Integer, nullable=True)
    vcpu_total = Column(Integer, nullable=True)
    memory_gb = Column(Float, nullable=True)
    cloud_provider = Column(String(50), nullable=True)
    arch = Column(String(50), nullable=True)
    health_state = Column(String(50), nullable=True)
    critical_alerts = Column(Integer, nullable=True, default=0)
    upgrade_available = Column(String(50), nullable=True)
    upgrade_state = Column(String(50), nullable=True)
    last_telemetry_at = Column(DateTime, nullable=True)
    synced_at = Column(DateTime, server_default=func.now())

    account = relationship("Account", back_populates="clusters")


# ---------------------------------------------------------------------------
# AccountEntitlement (Hydra cache)
# ---------------------------------------------------------------------------

class AccountEntitlement(Base):
    """Subscription entitlement — cached from Hydra API."""

    __tablename__ = "account_entitlements"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    sku = Column(String(100), nullable=True)
    entitlement_name = Column(String(500), nullable=False)
    service_level = Column(String(100), nullable=True)
    support_level = Column(String(100), nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    quantity = Column(Integer, nullable=True, default=1)
    synced_at = Column(DateTime, server_default=func.now())

    account = relationship("Account", back_populates="entitlements")


# ---------------------------------------------------------------------------
# AccountContact (Hydra cache + manual Red Hat team)
# ---------------------------------------------------------------------------

class AccountContact(Base):
    """Person associated with an account — customer team or Red Hat team."""

    __tablename__ = "account_contacts"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    sso_username = Column(String(100), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    title = Column(String(255), nullable=True)
    area = Column(String(100), nullable=True)
    is_tam_contact = Column(Boolean, nullable=False, default=False)
    is_org_admin = Column(Boolean, nullable=False, default=False)
    contact_type = Column(String(50), nullable=True)
    classification = Column(String(100), nullable=True)
    relationship_status = Column(String(50), nullable=True)
    team = Column(String(20), nullable=False, default="customer")  # customer | redhat
    status = Column(String(20), nullable=True, default="active")
    synced_at = Column(DateTime, server_default=func.now())

    account = relationship("Account", back_populates="contacts")


# ---------------------------------------------------------------------------
# AccountIssue (Jira-style issues)
# ---------------------------------------------------------------------------

class AccountIssue(Base):
    """Tracked issue (Jira or manual) linked to an account."""

    __tablename__ = "account_issues"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    key = Column(String(50), nullable=False)
    project = Column(String(100), nullable=True)
    summary = Column(Text, nullable=False)
    resolution = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="Open")
    issue_type = Column(String(50), nullable=True)
    priority = Column(String(50), nullable=True)
    affects_versions = Column(Text, nullable=True)
    target_version = Column(String(100), nullable=True)
    fix_versions = Column(Text, nullable=True)
    linked_cases = Column(Text, nullable=True)
    labels = Column(Text, nullable=True)
    creator = Column(String(255), nullable=True)
    assignee = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    resolved_at = Column(DateTime, nullable=True)

    account = relationship("Account", back_populates="issues")


# ---------------------------------------------------------------------------
# ActionPlan
# ---------------------------------------------------------------------------

class ActionPlan(Base):
    """Strategic initiative / action item for an account."""

    __tablename__ = "action_plans"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(Text, nullable=False)
    initiative_type = Column(String(100), nullable=True)
    problem = Column(Text, nullable=True)
    expected_outcome = Column(Text, nullable=True)
    business_impact = Column(String(50), nullable=True)
    risk_level = Column(String(50), nullable=True)
    customer_owner = Column(String(255), nullable=True)
    tam_name = Column(String(255), nullable=True)
    dee_name = Column(String(255), nullable=True)
    product = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="Not started yet")
    start_year = Column(Integer, nullable=True)
    start_quarter = Column(String(10), nullable=True)
    close_year = Column(Integer, nullable=True)
    close_quarter = Column(String(10), nullable=True)
    details_html = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    account = relationship("Account", back_populates="action_plans")


# ---------------------------------------------------------------------------
# Touchpoint
# ---------------------------------------------------------------------------

class Touchpoint(Base):
    """Interaction log entry with the customer."""

    __tablename__ = "touchpoints"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    touchpoint_date = Column(Date, nullable=False, default=date.today)
    participants = Column(Text, nullable=True)
    topics = Column(Text, nullable=True)
    customer_area = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    account = relationship("Account", back_populates="touchpoints")


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------

class Risk(Base):
    """Risk entry for an account with probability and impact assessment."""

    __tablename__ = "risks"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    short_name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    probability = Column(String(50), nullable=True)  # Low, Medium, High
    impact = Column(String(50), nullable=True)  # Low, Medium, High, Critical
    customer_area = Column(String(100), nullable=True)
    status = Column(String(50), nullable=False, default="Open")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    account = relationship("Account", back_populates="risks")


# ---------------------------------------------------------------------------
# Engagement
# ---------------------------------------------------------------------------

class Engagement(Base):
    """Quarterly engagement tracking per customer area."""

    __tablename__ = "engagements"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_area = Column(String(100), nullable=False)
    adoption_difficulty = Column(String(50), nullable=True)
    customer_knowledge = Column(String(50), nullable=True)
    team_turnover = Column(String(50), nullable=True)
    py_engagement = Column(String(50), nullable=True)  # previous year
    q1_engagement = Column(String(50), nullable=True)
    q2_engagement = Column(String(50), nullable=True)
    q3_engagement = Column(String(50), nullable=True)
    q4_engagement = Column(String(50), nullable=True)
    year = Column(Integer, nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    account = relationship("Account", back_populates="engagements")


# ---------------------------------------------------------------------------
# NpsSurvey
# ---------------------------------------------------------------------------

class NpsSurvey(Base):
    """NPS survey result for an account — manual entry by TAM or manager."""

    __tablename__ = "nps_surveys"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    tam_user_id = Column(Integer, ForeignKey("admin_users.id"), nullable=True)
    score = Column(Integer, nullable=False)  # 0-10
    feedback_text = Column(Text, nullable=True)
    survey_date = Column(Date, nullable=False, default=date.today)
    quarter = Column(String(10), nullable=True)
    year = Column(Integer, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    account = relationship("Account", back_populates="nps_surveys")
    tam_user = relationship("AdminUser")


# ---------------------------------------------------------------------------
# ProductLifecycle (cache from lifecycle API)
# ---------------------------------------------------------------------------

class ProductLifecycle(Base):
    """Product version lifecycle phases — cached from Red Hat Lifecycle API."""

    __tablename__ = "product_lifecycles"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=True, index=True)
    product_name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    phases_json = Column(Text, nullable=True)  # full phases data from API
    current_phase = Column(String(100), nullable=True)
    ga_date = Column(Date, nullable=True)
    full_support_end = Column(Date, nullable=True)
    maintenance_end = Column(Date, nullable=True)
    eus_end = Column(Date, nullable=True)
    customer_environment = Column(String(50), nullable=True)  # indicates if customer uses this version
    qty_installs = Column(Integer, nullable=True)
    synced_at = Column(DateTime, server_default=func.now())

    account = relationship("Account", back_populates="lifecycle_entries")


# ---------------------------------------------------------------------------
# Existing models (preserved with minor additions)
# ---------------------------------------------------------------------------

class Customer(Base):
    """Legacy customer entity — kept for backward compatibility with existing guides."""

    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())

    guides = relationship("Guide", back_populates="customer")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(255), nullable=False, unique=True)
    created_at = Column(DateTime, server_default=func.now())

    guides = relationship("Guide", back_populates="product")


class DocumentType(Base):
    __tablename__ = "document_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    slug = Column(String(255), nullable=False, unique=True)
    color = Column(String(7), nullable=False, default="#70728F")
    created_at = Column(DateTime, server_default=func.now())

    guides = relationship("Guide", back_populates="document_type")


class LLMProvider(Base):
    __tablename__ = "llm_providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    provider_type = Column(String(50), nullable=False)
    base_url = Column(String(500), nullable=True)
    api_key_encrypted = Column(Text, nullable=True)
    default_model = Column(String(255), nullable=False)
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    guides = relationship("Guide", back_populates="provider")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)

    guides = relationship("Guide", secondary=guide_tags, back_populates="tags")


class Guide(Base):
    """Generated content document — linked to an account optionally."""

    __tablename__ = "guides"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    document_type_id = Column(Integer, ForeignKey("document_types.id"), nullable=False)
    provider_id = Column(Integer, ForeignKey("llm_providers.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=True)  # optional link to account
    model_used = Column(String(255), nullable=True)
    touchpoint_date = Column(Date, nullable=False, default=date.today)
    input_notes = Column(Text, nullable=False)
    html_filename = Column(String(500), nullable=True)
    status = Column(String(50), nullable=False, default="draft")
    kcs_subtype = Column(String(50), nullable=True)
    access_token = Column(String(64), nullable=False, default=_generate_token, index=True)
    embedding = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    customer = relationship("Customer", back_populates="guides")
    product = relationship("Product", back_populates="guides")
    document_type = relationship("DocumentType", back_populates="guides")
    provider = relationship("LLMProvider", back_populates="guides")
    account = relationship("Account", back_populates="guides")
    tags = relationship("Tag", secondary=guide_tags, back_populates="guides")
    assessment_responses = relationship("AssessmentResponse", back_populates="guide", cascade="all, delete-orphan")


class AssessmentResponse(Base):
    __tablename__ = "assessment_responses"

    id = Column(Integer, primary_key=True, index=True)
    guide_id = Column(Integer, ForeignKey("guides.id", ondelete="CASCADE"), nullable=False)
    respondent_name = Column(String(255), nullable=False)
    responses_json = Column(Text, nullable=False)
    submitted_at = Column(DateTime, server_default=func.now())

    guide = relationship("Guide", back_populates="assessment_responses")
