export type UserListMode = "active" | "trash" | "all";

export type UserListItem = {
  id: number;
  tenant_id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  deleted_at: string | null;
  roles: string[];
};

export type UserDetail = UserListItem;

export type UserPermissionsView = {
  user_id: number;
  role_permissions: string[];
  overrides: { permission_code: string; effect: "ALLOW" | "DENY" }[];
  effective_permissions: string[];
};

export type UserRoleCatalogItem = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type PermissionCatalogItem = {
  code: string;
  module: string;
  module_mean: string | null;
  description: string | null;
};

export type RolePermissionCatalogItem = {
  permission_code: string;
  module: string;
  module_mean: string | null;
  description: string | null;
  is_active: boolean;
};

export type RolePermissionModuleGroup = {
  module: string;
  module_mean: string | null;
  has_manage_active: boolean;
  permissions: RolePermissionCatalogItem[];
};

export type RolePermissionsView = {
  role_id: number;
  role_name: string;
  role_description: string | null;
  permissions: RolePermissionCatalogItem[];
  modules: RolePermissionModuleGroup[];
};

export type CreateUserPayload = {
  email: string;
  full_name: string;
  password: string;
  role_ids: number[];
};

export type UpdateUserPayload = {
  email?: string;
  full_name?: string;
  role_ids?: number[];
  password?: string;
};

export type CreateRolePayload = {
  name: string;
  description?: string;
};
