import { httpClient } from "@/services/http/client";
import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type {
  CreateRolePayload,
  CreateUserPayload,
  PermissionCatalogItem,
  RolePermissionCatalogItem,
  RolePermissionsView,
  UpdateUserPayload,
  UserDetail,
  UserListItem,
  UserListMode,
  UserPermissionsView,
  UserRoleCatalogItem,
} from "@/features/users/types";
import { toPaginated } from "@/services/http/pagination";

type DeleteResult = {
  deleted: boolean;
};

export const usersApi = {
  async list(mode: UserListMode): Promise<UserListItem[]> {
    const { data } = await httpClient.get<
      ApiEnvelope<UserListItem[] | PaginatedResponse<UserListItem>>
    >("/users", {
      params: { deleted_mode: mode, page: 1, items_per_page: 200 },
    });
    if (!data.response) {
      throw new Error(data.message || "Không thể tải danh sách user.");
    }
    return toPaginated(data.response).items;
  },

  async detail(userId: number): Promise<UserDetail> {
    const { data } = await httpClient.get<ApiEnvelope<UserDetail>>(
      `/users/${userId}`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể tải thông tin user.");
    }
    return data.response;
  },

  async create(payload: CreateUserPayload): Promise<UserDetail> {
    const { data } = await httpClient.post<ApiEnvelope<UserDetail>>(
      "/users",
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể thêm user.");
    }
    return data.response;
  },

  async update(
    userId: number,
    payload: UpdateUserPayload,
  ): Promise<UserDetail> {
    const { data } = await httpClient.put<ApiEnvelope<UserDetail>>(
      `/users/${userId}`,
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật user.");
    }
    return data.response;
  },

  async setActive(userId: number, isActive: boolean): Promise<UserDetail> {
    const { data } = await httpClient.patch<ApiEnvelope<UserDetail>>(
      `/users/${userId}/active`,
      { is_active: isActive },
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật trạng thái active.");
    }
    return data.response;
  },

  async softDelete(userId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/users/${userId}`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể xóa mềm user.");
    }
    return data.response;
  },

  async hardDelete(userId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/users/${userId}/hard`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể xóa vĩnh viễn user.");
    }
    return data.response;
  },

  async permissions(userId: number): Promise<UserPermissionsView> {
    const { data } = await httpClient.get<ApiEnvelope<UserPermissionsView>>(
      `/users/${userId}/permissions`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể xem quyền của user.");
    }
    return data.response;
  },

  async rolesCatalog(targetUserId?: number): Promise<UserRoleCatalogItem[]> {
    const { data } = await httpClient.get<ApiEnvelope<UserRoleCatalogItem[]>>(
      "/users/roles/catalog",
      {
        params: targetUserId ? { target_user_id: targetUserId } : undefined,
      },
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể tải danh sách vai trò.");
    }
    return data.response;
  },

  async setRoleActive(
    userId: number,
    roleId: number,
    isActive: boolean,
  ): Promise<UserDetail> {
    const { data } = await httpClient.patch<ApiEnvelope<UserDetail>>(
      `/users/${userId}/roles/${roleId}/active`,
      { is_active: isActive },
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật vai trò cho user.");
    }
    return data.response;
  },

  async permissionCatalog(): Promise<PermissionCatalogItem[]> {
    const { data } = await httpClient.get<ApiEnvelope<PermissionCatalogItem[]>>(
      "/users/permissions/catalog",
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể tải danh mục quyền.");
    }
    return data.response;
  },

  async createRole(payload: CreateRolePayload): Promise<UserRoleCatalogItem> {
    const { data } = await httpClient.post<ApiEnvelope<UserRoleCatalogItem>>(
      "/users/roles",
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể tạo vai trò mới.");
    }
    return data.response;
  },

  async rolePermissions(roleId: number): Promise<RolePermissionsView> {
    const { data } = await httpClient.get<ApiEnvelope<RolePermissionsView>>(
      `/users/roles/${roleId}/permissions`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể tải quyền của vai trò.");
    }
    return data.response;
  },

  async setRolePermissionActive(
    roleId: number,
    permissionCode: string,
    isActive: boolean,
  ): Promise<RolePermissionCatalogItem> {
    const { data } = await httpClient.patch<
      ApiEnvelope<RolePermissionCatalogItem>
    >(
      `/users/roles/${roleId}/permissions/${encodeURIComponent(permissionCode)}/active`,
      { is_active: isActive },
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật quyền cho vai trò.");
    }
    return data.response;
  },
};
