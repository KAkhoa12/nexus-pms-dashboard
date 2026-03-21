export type User = {
  id: number;
  tenantId: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  authProvider: string;
  isActive: boolean;
  roles: string[];
};

export type SubscriptionAccess = {
  packageCode: string;
  packageName: string;
  packageSource: string;
  teamId: number | null;
  featureCodes: string[];
  canUseSunsetTheme: boolean;
  aiTaskManagementEnabled: boolean;
  internalChatEnabled: boolean;
};

export type UserPreferences = {
  themeMode: string | null;
  workspaceKey: string | null;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type GoogleLoginPayload = {
  credential: string;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
};

export type MeResponse = {
  id: number;
  tenant_id: number;
  email: string;
  full_name: string;
  avatar_url: string | null;
  auth_provider: string;
  is_active: boolean;
  roles: string[];
  permissions: string[];
  effective_package_code: string;
  effective_package_name: string;
  effective_package_source: string;
  effective_team_id: number | null;
  feature_codes: string[];
  can_use_sunset_theme: boolean;
  ai_task_management_enabled: boolean;
  internal_chat_enabled: boolean;
  preference_theme_mode: string | null;
  preference_workspace_key: string | null;
};

export type AuthContext = {
  user: User;
  permissions: string[];
  subscription: SubscriptionAccess;
  preferences: UserPreferences;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  response: T | null;
};

export type PaginationMeta = {
  page: number;
  items_per_page: number;
  total_items: number;
  total_pages: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: PaginationMeta;
};
