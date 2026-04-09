from datetime import date, datetime
from pydantic import BaseModel, Field


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
    model_override: str | None = None
    touchpoint_date: date = Field(default_factory=date.today)
    input_notes: str = Field(min_length=1)
    tags: list[str] = []
    kcs_subtype: str | None = None

class GuideRead(BaseModel):
    id: int
    title: str
    customer_id: int
    product_id: int
    document_type_id: int
    provider_id: int | None
    model_used: str | None
    touchpoint_date: date
    input_notes: str
    html_filename: str | None
    status: str
    kcs_subtype: str | None
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

class ChartDataPoint(BaseModel):
    label: str
    value: int

class TimeSeriesPoint(BaseModel):
    date: str
    label: str
    value: int
