import type { PaginatedResponse } from "@/features/auth/types";

export type DeveloperLoginPayload = {
  email: string;
  password: string;
};

export type DeveloperTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type DeveloperAdmin = {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  last_login_at: string | null;
};

export type PackageDistribution = {
  package_id: number;
  package_code: string;
  package_name: string;
  subscriber_count: number;
};

export type DeveloperOverview = {
  total_users: number;
  active_users: number;
  total_teams: number;
  total_paid_subscriptions: number;
  total_revenue: string;
  mrr_estimate: string;
  currency: string;
  last_user_registered_at: string | null;
  package_distribution: PackageDistribution[];
};

export type DeveloperUserSubscription = {
  id: number;
  package_id: number;
  package_code: string;
  package_name: string;
  status: string;
  billing_cycle: string;
  price_amount: string;
  currency: string;
  started_at: string;
  ended_at: string | null;
  auto_renew: boolean;
  note: string | null;
};

export type DeveloperUser = {
  id: number;
  tenant_id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  subscription: DeveloperUserSubscription | null;
};

export type DeveloperUserPackageUpdatePayload = {
  package_id?: number;
  package_code?: string;
  billing_cycle?: "MONTHLY" | "YEARLY";
  note?: string | null;
};

export type DeveloperUserListResponse = PaginatedResponse<DeveloperUser>;

export type SaasPackageFeature = {
  id: number;
  feature_key: string;
  feature_name: string;
  feature_description: string | null;
  is_included: boolean;
  limit_value: string | null;
  sort_order: number;
};

export type SaasPackage = {
  id: number;
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  monthly_price: string;
  yearly_price: string | null;
  currency: string;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  max_users: number | null;
  max_rooms: number | null;
  ai_task_management_enabled: boolean;
  ai_quota_monthly: number | null;
  created_at: string;
  updated_at: string;
  features: SaasPackageFeature[];
};

export type SaasPackageFeatureInput = {
  feature_key: string;
  feature_name: string;
  feature_description?: string | null;
  is_included: boolean;
  limit_value?: string | null;
  sort_order: number;
};

export type SaasPackageUpsertPayload = {
  code: string;
  name: string;
  tagline?: string | null;
  description?: string | null;
  monthly_price: number;
  yearly_price?: number | null;
  currency: string;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
  max_users?: number | null;
  max_rooms?: number | null;
  ai_task_management_enabled: boolean;
  ai_quota_monthly?: number | null;
  features: SaasPackageFeatureInput[];
};

export type LandingSection = {
  id: number;
  page_slug: string;
  locale: string;
  section_key: string;
  title: string | null;
  subtitle: string | null;
  body_text: string | null;
  content_json: string | null;
  cta_label: string | null;
  cta_url: string | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type LandingSectionUpsertPayload = {
  page_slug: string;
  locale: string;
  section_key: string;
  title?: string | null;
  subtitle?: string | null;
  body_text?: string | null;
  content_json?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  is_published: boolean;
  sort_order: number;
};

export type PlanListResponse = PaginatedResponse<SaasPackage>;
export type LandingSectionListResponse = PaginatedResponse<LandingSection>;

export type DeveloperPermission = {
  code: string;
  module: string;
  module_mean: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type DeveloperPermissionUpdatePayload = {
  description: string | null;
};

export type DeveloperPermissionListResponse =
  PaginatedResponse<DeveloperPermission>;
