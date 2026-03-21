import { httpClient } from "@/services/http/client";
import type {
  ApiEnvelope,
  AuthContext,
  GoogleLoginPayload,
  LoginPayload,
  LoginResponse,
  MeResponse,
} from "@/features/auth/types";

export const authApi = {
  async login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await httpClient.post<ApiEnvelope<LoginResponse>>(
      "/auth/login",
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Đăng nhập thất bại.");
    }
    return data.response;
  },
  async loginWithGoogle(payload: GoogleLoginPayload): Promise<LoginResponse> {
    const { data } = await httpClient.post<ApiEnvelope<LoginResponse>>(
      "/auth/google",
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Đăng nhập Google thất bại.");
    }
    return data.response;
  },
  async refresh(refreshToken: string): Promise<LoginResponse> {
    const { data } = await httpClient.post<ApiEnvelope<LoginResponse>>(
      "/auth/refresh",
      { refresh_token: refreshToken },
    );
    if (!data.response) {
      throw new Error(data.message || "Làm mới phiên đăng nhập thất bại.");
    }
    return data.response;
  },
  async me(): Promise<AuthContext> {
    const { data } = await httpClient.get<ApiEnvelope<MeResponse>>("/auth/me");
    if (!data.response) {
      throw new Error(data.message || "Không thể lấy thông tin người dùng.");
    }

    return {
      user: {
        id: data.response.id,
        tenantId: data.response.tenant_id,
        email: data.response.email,
        fullName: data.response.full_name,
        avatarUrl: data.response.avatar_url,
        authProvider: data.response.auth_provider,
        isActive: data.response.is_active,
        roles: data.response.roles,
      },
      permissions: data.response.permissions,
      subscription: {
        packageCode: data.response.effective_package_code,
        packageName: data.response.effective_package_name,
        packageSource: data.response.effective_package_source,
        teamId: data.response.effective_team_id,
        featureCodes: data.response.feature_codes,
        canUseSunsetTheme: data.response.can_use_sunset_theme,
        aiTaskManagementEnabled: data.response.ai_task_management_enabled,
        internalChatEnabled: data.response.internal_chat_enabled,
      },
      preferences: {
        themeMode: data.response.preference_theme_mode,
        workspaceKey: data.response.preference_workspace_key,
      },
    };
  },

  async updatePreferences(payload: {
    theme_mode?: string | null;
    workspace_key?: string | null;
  }): Promise<{ theme_mode: string | null; workspace_key: string | null }> {
    const { data } = await httpClient.put<
      ApiEnvelope<{ theme_mode: string | null; workspace_key: string | null }>
    >("/auth/preferences", payload);
    if (!data.response) {
      throw new Error(data.message || "Không thể lưu cài đặt người dùng.");
    }
    return data.response;
  },
};
