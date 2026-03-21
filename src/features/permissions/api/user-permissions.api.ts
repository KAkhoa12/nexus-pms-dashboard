import { httpClient } from "@/services/http/client";
import type { ApiEnvelope } from "@/features/auth/types";
import type {
  DeleteUserPermissionResult,
  PermissionEffect,
  UserPermissionOverride,
} from "@/features/permissions/types";

export const userPermissionsApi = {
  async create(payload: {
    targetUserId: number;
    permissionCode: string;
    effect: PermissionEffect;
  }): Promise<UserPermissionOverride> {
    const { data } = await httpClient.post<ApiEnvelope<UserPermissionOverride>>(
      `/user-permissions/users/${payload.targetUserId}/permissions`,
      {
        permission_code: payload.permissionCode,
        effect: payload.effect,
      },
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể thêm quyền cho user.");
    }
    return data.response;
  },

  async update(payload: {
    targetUserId: number;
    permissionCode: string;
    effect: PermissionEffect;
  }): Promise<UserPermissionOverride> {
    const { data } = await httpClient.put<ApiEnvelope<UserPermissionOverride>>(
      `/user-permissions/users/${payload.targetUserId}/permissions/${encodeURIComponent(payload.permissionCode)}`,
      { effect: payload.effect },
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật quyền cho user.");
    }
    return data.response;
  },

  async remove(payload: {
    targetUserId: number;
    permissionCode: string;
  }): Promise<DeleteUserPermissionResult> {
    const { data } = await httpClient.delete<
      ApiEnvelope<DeleteUserPermissionResult>
    >(
      `/user-permissions/users/${payload.targetUserId}/permissions/${encodeURIComponent(payload.permissionCode)}`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể xóa quyền của user.");
    }
    return data.response;
  },

  async removeHard(payload: {
    targetUserId: number;
    permissionCode: string;
  }): Promise<DeleteUserPermissionResult> {
    const { data } = await httpClient.delete<
      ApiEnvelope<DeleteUserPermissionResult>
    >(
      `/user-permissions/users/${payload.targetUserId}/permissions/${encodeURIComponent(payload.permissionCode)}/hard`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể xóa cứng quyền của user.");
    }
    return data.response;
  },
};
