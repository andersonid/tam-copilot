export interface Customer {
  id: number;
  name: string;
  slug: string;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  slug: string;
}

export interface DocumentType {
  id: number;
  name: string;
  slug: string;
}

export interface LLMProvider {
  id: number;
  name: string;
  provider_type: string;
  base_url: string | null;
  default_model: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
}

export interface Guide {
  id: number;
  title: string;
  customer_id: number;
  product_id: number;
  document_type_id: number;
  provider_id: number | null;
  model_used: string | null;
  touchpoint_date: string;
  input_notes: string;
  html_filename: string | null;
  status: string;
  kcs_subtype: string | null;
  access_token: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  product?: Product;
  document_type?: DocumentType;
  provider?: LLMProvider;
  tags?: Tag[];
}

export interface GuideCreate {
  title?: string;
  customer_id: number;
  product_id: number;
  document_type_id: number;
  provider_id?: number;
  model_override?: string;
  touchpoint_date: string;
  input_notes: string;
  tags: string[];
  kcs_subtype?: string;
}

export interface SimilarGuide {
  id: number;
  title: string;
  score: number;
  customer_name: string;
  product_name: string;
  touchpoint_date: string;
}

export interface SearchResult {
  id: number;
  title: string;
  customer_name: string;
  product_name: string;
  document_type_name: string;
  touchpoint_date: string;
  score: number;
  source: string;
}

export interface AnalyticsOverview {
  total_guides: number;
  guides_this_month: number;
  total_customers: number;
  active_providers: number;
}

export interface ChartDataPoint {
  label: string;
  value: number;
}
