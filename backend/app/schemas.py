"""Pydantic schemas for request/response validation.

Organized by domain: accounts, clusters, entitlements, contacts, issues,
action plans, touchpoints, risks, engagement, NPS, lifecycle, guides,
search, and analytics.
"""

from datetime import date, datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------

class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    account_number: str = Field(min_length=1, max_length=50)
    region: str | None = None
    country: str | None = None
    tam_user_id: int | None = None
    tam_type: str | None = None
    service_days_json: str | None = None
    purchased_products_json: str | None = None
    notes: str | None = None

class AccountUpdate(BaseModel):
    name: str | None = None
    region: str | None = None
    country: str | None = None
    tam_user_id: int | None = None
    tam_type: str | None = None
    service_days_json: str | None = None
    purchased_products_json: str | None = None
    notes: str | None = None
    is_active: bool | None = None

class AccountRead(BaseModel):
    id: int
    name: str
    account_number: str
    region: str | None
    country: str | None
    tam_user_id: int | None
    tam_type: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class AccountListRead(BaseModel):
    id: int
    name: str
    account_number: str
    region: str | None
    country: str | None
    tam_type: str | None
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Clusters
# ---------------------------------------------------------------------------

class ClusterCreate(BaseModel):
    external_cluster_id: str = Field(min_length=1, max_length=100)
    display_name: str | None = None
    status: str | None = None
    console_url: str | None = None
    openshift_version: str | None = None
    lifecycle_phase: str | None = None
    master_nodes: int | None = None
    compute_nodes: int | None = None
    vcpu_total: int | None = None
    memory_gb: float | None = None
    cloud_provider: str | None = None
    arch: str | None = None
    health_state: str | None = None
    critical_alerts: int | None = 0
    upgrade_available: str | None = None
    upgrade_state: str | None = None

class ClusterUpdate(BaseModel):
    display_name: str | None = None
    status: str | None = None
    console_url: str | None = None
    openshift_version: str | None = None
    lifecycle_phase: str | None = None
    master_nodes: int | None = None
    compute_nodes: int | None = None
    vcpu_total: int | None = None
    memory_gb: float | None = None
    cloud_provider: str | None = None
    arch: str | None = None
    health_state: str | None = None
    critical_alerts: int | None = None
    upgrade_available: str | None = None
    upgrade_state: str | None = None

class ClusterRead(BaseModel):
    id: int
    account_id: int
    external_cluster_id: str
    display_name: str | None
    status: str | None
    console_url: str | None
    openshift_version: str | None
    lifecycle_phase: str | None
    master_nodes: int | None
    compute_nodes: int | None
    vcpu_total: int | None
    memory_gb: float | None
    cloud_provider: str | None
    arch: str | None
    health_state: str | None
    critical_alerts: int | None
    upgrade_available: str | None
    upgrade_state: str | None
    last_telemetry_at: datetime | None
    synced_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Entitlements
# ---------------------------------------------------------------------------

class EntitlementCreate(BaseModel):
    entitlement_name: str = Field(min_length=1, max_length=500)
    sku: str | None = None
    service_level: str | None = None
    support_level: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    quantity: int | None = 1

class EntitlementUpdate(BaseModel):
    entitlement_name: str | None = None
    sku: str | None = None
    service_level: str | None = None
    support_level: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    quantity: int | None = None

class EntitlementRead(BaseModel):
    id: int
    account_id: int
    sku: str | None
    entitlement_name: str
    service_level: str | None
    support_level: str | None
    start_date: date | None
    end_date: date | None
    quantity: int | None
    synced_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------

class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    sso_username: str | None = None
    email: str | None = None
    phone: str | None = None
    title: str | None = None
    area: str | None = None
    is_tam_contact: bool = False
    is_org_admin: bool = False
    contact_type: str | None = None
    classification: str | None = None
    relationship_status: str | None = None
    team: str = Field(default="customer", pattern=r"^(customer|redhat)$")
    status: str | None = "active"

class ContactUpdate(BaseModel):
    name: str | None = None
    sso_username: str | None = None
    email: str | None = None
    phone: str | None = None
    title: str | None = None
    area: str | None = None
    is_tam_contact: bool | None = None
    is_org_admin: bool | None = None
    contact_type: str | None = None
    classification: str | None = None
    relationship_status: str | None = None
    team: str | None = None
    status: str | None = None

class ContactRead(BaseModel):
    id: int
    account_id: int
    name: str
    sso_username: str | None
    email: str | None
    phone: str | None
    title: str | None
    area: str | None
    is_tam_contact: bool
    is_org_admin: bool
    contact_type: str | None
    classification: str | None
    relationship_status: str | None
    team: str
    status: str | None
    synced_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Issues
# ---------------------------------------------------------------------------

class IssueCreate(BaseModel):
    key: str = Field(min_length=1, max_length=50)
    project: str | None = None
    summary: str = Field(min_length=1)
    resolution: str | None = None
    status: str = "Open"
    issue_type: str | None = None
    priority: str | None = None
    affects_versions: str | None = None
    target_version: str | None = None
    fix_versions: str | None = None
    linked_cases: str | None = None
    labels: str | None = None
    creator: str | None = None
    assignee: str | None = None
    resolved_at: datetime | None = None

class IssueUpdate(BaseModel):
    summary: str | None = None
    resolution: str | None = None
    status: str | None = None
    issue_type: str | None = None
    priority: str | None = None
    affects_versions: str | None = None
    target_version: str | None = None
    fix_versions: str | None = None
    linked_cases: str | None = None
    labels: str | None = None
    assignee: str | None = None
    resolved_at: datetime | None = None

class IssueRead(BaseModel):
    id: int
    account_id: int
    key: str
    project: str | None
    summary: str
    resolution: str | None
    status: str
    issue_type: str | None
    priority: str | None
    affects_versions: str | None
    target_version: str | None
    fix_versions: str | None
    linked_cases: str | None
    labels: str | None
    creator: str | None
    assignee: str | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Action Plans
# ---------------------------------------------------------------------------

class ActionPlanCreate(BaseModel):
    description: str = Field(min_length=1)
    initiative_type: str | None = None
    problem: str | None = None
    expected_outcome: str | None = None
    business_impact: str | None = None
    risk_level: str | None = None
    customer_owner: str | None = None
    tam_name: str | None = None
    dee_name: str | None = None
    product: str | None = None
    status: str = "Not started yet"
    start_year: int | None = None
    start_quarter: str | None = None
    close_year: int | None = None
    close_quarter: str | None = None
    details_html: str | None = None
    sort_order: int = 0

class ActionPlanUpdate(BaseModel):
    description: str | None = None
    initiative_type: str | None = None
    problem: str | None = None
    expected_outcome: str | None = None
    business_impact: str | None = None
    risk_level: str | None = None
    customer_owner: str | None = None
    tam_name: str | None = None
    dee_name: str | None = None
    product: str | None = None
    status: str | None = None
    start_year: int | None = None
    start_quarter: str | None = None
    close_year: int | None = None
    close_quarter: str | None = None
    details_html: str | None = None
    sort_order: int | None = None

class ActionPlanRead(BaseModel):
    id: int
    account_id: int
    description: str
    initiative_type: str | None
    problem: str | None
    expected_outcome: str | None
    business_impact: str | None
    risk_level: str | None
    customer_owner: str | None
    tam_name: str | None
    dee_name: str | None
    product: str | None
    status: str
    start_year: int | None
    start_quarter: str | None
    close_year: int | None
    close_quarter: str | None
    details_html: str | None
    sort_order: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Touchpoints
# ---------------------------------------------------------------------------

class TouchpointCreate(BaseModel):
    touchpoint_date: date = Field(default_factory=date.today)
    participants: str | None = None
    topics: str | None = None
    customer_area: str | None = None

class TouchpointUpdate(BaseModel):
    touchpoint_date: date | None = None
    participants: str | None = None
    topics: str | None = None
    customer_area: str | None = None

class TouchpointRead(BaseModel):
    id: int
    account_id: int
    touchpoint_date: date
    participants: str | None
    topics: str | None
    customer_area: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Risks
# ---------------------------------------------------------------------------

class RiskCreate(BaseModel):
    short_name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    probability: str | None = None
    impact: str | None = None
    customer_area: str | None = None
    status: str = "Open"

class RiskUpdate(BaseModel):
    short_name: str | None = None
    description: str | None = None
    probability: str | None = None
    impact: str | None = None
    customer_area: str | None = None
    status: str | None = None

class RiskRead(BaseModel):
    id: int
    account_id: int
    short_name: str
    description: str | None
    probability: str | None
    impact: str | None
    customer_area: str | None
    status: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Engagement
# ---------------------------------------------------------------------------

class EngagementCreate(BaseModel):
    customer_area: str = Field(min_length=1, max_length=100)
    adoption_difficulty: str | None = None
    customer_knowledge: str | None = None
    team_turnover: str | None = None
    py_engagement: str | None = None
    q1_engagement: str | None = None
    q2_engagement: str | None = None
    q3_engagement: str | None = None
    q4_engagement: str | None = None
    year: int

class EngagementUpdate(BaseModel):
    customer_area: str | None = None
    adoption_difficulty: str | None = None
    customer_knowledge: str | None = None
    team_turnover: str | None = None
    py_engagement: str | None = None
    q1_engagement: str | None = None
    q2_engagement: str | None = None
    q3_engagement: str | None = None
    q4_engagement: str | None = None
    year: int | None = None

class EngagementRead(BaseModel):
    id: int
    account_id: int
    customer_area: str
    adoption_difficulty: str | None
    customer_knowledge: str | None
    team_turnover: str | None
    py_engagement: str | None
    q1_engagement: str | None
    q2_engagement: str | None
    q3_engagement: str | None
    q4_engagement: str | None
    year: int
    updated_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# NPS Surveys
# ---------------------------------------------------------------------------

class NpsCreate(BaseModel):
    account_id: int
    tam_user_id: int | None = None
    score: int = Field(ge=0, le=10)
    feedback_text: str | None = None
    survey_date: date = Field(default_factory=date.today)
    quarter: str | None = None
    year: int | None = None

class NpsRead(BaseModel):
    id: int
    account_id: int
    tam_user_id: int | None
    score: int
    feedback_text: str | None
    survey_date: date
    quarter: str | None
    year: int | None
    created_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Product Lifecycle
# ---------------------------------------------------------------------------

class LifecycleCreate(BaseModel):
    product_name: str = Field(min_length=1, max_length=255)
    version: str = Field(min_length=1, max_length=50)
    phases_json: str | None = None
    current_phase: str | None = None
    ga_date: date | None = None
    full_support_end: date | None = None
    maintenance_end: date | None = None
    eus_end: date | None = None
    customer_environment: str | None = None
    qty_installs: int | None = None

class LifecycleUpdate(BaseModel):
    phases_json: str | None = None
    current_phase: str | None = None
    ga_date: date | None = None
    full_support_end: date | None = None
    maintenance_end: date | None = None
    eus_end: date | None = None
    customer_environment: str | None = None
    qty_installs: int | None = None

class LifecycleRead(BaseModel):
    id: int
    account_id: int | None
    product_name: str
    version: str
    phases_json: str | None
    current_phase: str | None
    ga_date: date | None
    full_support_end: date | None
    maintenance_end: date | None
    eus_end: date | None
    customer_environment: str | None
    qty_installs: int | None
    synced_at: datetime
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# User profile
# ---------------------------------------------------------------------------

class UserRead(BaseModel):
    id: int
    username: str
    email: str | None
    full_name: str | None
    sso_username: str | None
    role: str
    tam_type: str | None
    certifications_json: str | None
    skills_tags: str | None
    created_at: datetime
    model_config = {"from_attributes": True}

class UserUpdate(BaseModel):
    email: str | None = None
    full_name: str | None = None
    sso_username: str | None = None
    role: str | None = None
    tam_type: str | None = None
    certifications_json: str | None = None
    skills_tags: str | None = None
    service_days_config_json: str | None = None


# ---------------------------------------------------------------------------
# Legacy / existing schemas (preserved)
# ---------------------------------------------------------------------------

class CustomerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)

class CustomerRead(BaseModel):
    id: int
    name: str
    slug: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ProductRead(BaseModel):
    id: int
    name: str
    slug: str
    created_at: datetime
    model_config = {"from_attributes": True}

class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class DocumentTypeRead(BaseModel):
    id: int
    name: str
    slug: str
    color: str
    created_at: datetime
    model_config = {"from_attributes": True}

class DocumentTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    color: str = Field(default="#70728F", pattern=r"^#[0-9a-fA-F]{6}$")


class TagRead(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


class LLMProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    provider_type: str = Field(pattern=r"^(openai_compatible|anthropic|google_gemini)$")
    base_url: str | None = None
    api_key: str | None = None
    default_model: str = Field(min_length=1, max_length=255)

class LLMProviderUpdate(BaseModel):
    name: str | None = None
    provider_type: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    default_model: str | None = None
    is_active: bool | None = None

class LLMProviderRead(BaseModel):
    id: int
    name: str
    provider_type: str
    base_url: str | None
    default_model: str
    is_default: bool
    is_active: bool
    created_at: datetime
    has_api_key: bool = False
    model_config = {"from_attributes": True}


class GuideCreate(BaseModel):
    title: str | None = None
    customer_id: int
    product_id: int
    document_type_id: int
    provider_id: int | None = None
    account_id: int | None = None
    model_override: str | None = None
    touchpoint_date: date = Field(default_factory=date.today)
    input_notes: str = Field(min_length=1)
    tags: list[str] = []
    kcs_subtype: str | None = None
    use_kcs_rag: bool = False

class GuideRead(BaseModel):
    id: int
    title: str
    customer_id: int
    product_id: int
    document_type_id: int
    provider_id: int | None
    account_id: int | None
    model_used: str | None
    touchpoint_date: date
    input_notes: str
    html_filename: str | None
    status: str
    kcs_subtype: str | None
    access_token: str | None = None
    created_at: datetime
    updated_at: datetime
    customer: CustomerRead | None = None
    product: ProductRead | None = None
    document_type: DocumentTypeRead | None = None
    provider: LLMProviderRead | None = None
    tags: list[TagRead] = []
    model_config = {"from_attributes": True}

class GuideListRead(BaseModel):
    id: int
    title: str
    customer: CustomerRead | None = None
    product: ProductRead | None = None
    document_type: DocumentTypeRead | None = None
    touchpoint_date: date
    status: str
    model_used: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


class SimilarGuide(BaseModel):
    id: int
    title: str
    customer_name: str
    product_name: str
    similarity: float
    touchpoint_date: date

class CheckSimilarRequest(BaseModel):
    input_notes: str = Field(min_length=1)

class CheckSimilarResponse(BaseModel):
    has_similar: bool
    similar_guides: list[SimilarGuide] = []


class SearchResult(BaseModel):
    id: int
    title: str
    customer_name: str
    product_name: str
    document_type_name: str
    touchpoint_date: date
    relevance: float
    snippet: str = ""
    model_config = {"from_attributes": True}

class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    mode: str = Field(default="combined", pattern=r"^(keyword|semantic|combined)$")


class AnalyticsOverview(BaseModel):
    total_guides: int
    guides_this_month: int
    total_customers: int
    active_providers: int
    total_accounts: int = 0
    total_open_cases: int = 0
    unhealthy_clusters: int = 0

class ChartDataPoint(BaseModel):
    label: str
    value: int

class TimeSeriesPoint(BaseModel):
    date: str
    label: str
    value: int


class AssessmentResponseCreate(BaseModel):
    respondent_name: str = Field(min_length=1, max_length=255)
    responses: dict

class AssessmentResponseRead(BaseModel):
    id: int
    guide_id: int
    respondent_name: str
    responses_json: str
    submitted_at: datetime
    model_config = {"from_attributes": True}
