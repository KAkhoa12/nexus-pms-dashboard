import type { ApiEnvelope } from "@/features/auth/types";
import { developerHttpClient } from "@/features/developer-portal/auth/client";
import type {
  DeveloperAdmin,
  DeveloperLoginPayload,
  DeveloperOverview,
  DeveloperPermission,
  DeveloperPermissionListResponse,
  DeveloperTokenResponse,
  DeveloperUser,
  DeveloperUserListResponse,
  DeveloperPermissionUpdatePayload,
  DeveloperUserPackageUpdatePayload,
  LandingSection,
  LandingSectionListResponse,
  LandingSectionUpsertPayload,
  PlanListResponse,
  SaasPackage,
  SaasPackageUpsertPayload,
} from "@/features/developer-portal/types";

type ListQuery = {
  page?: number;
  items_per_page?: number;
};

export const developerApi = {
  async login(payload: DeveloperLoginPayload): Promise<DeveloperTokenResponse> {
    const { data } = await developerHttpClient.post<
      ApiEnvelope<DeveloperTokenResponse>
    >("/developer/auth/login", payload);
    if (!data.response) {
      throw new Error(data.message || "Đăng nhập developer thất bại.");
    }
    return data.response;
  },

  async me(): Promise<DeveloperAdmin> {
    const { data } =
      await developerHttpClient.get<ApiEnvelope<DeveloperAdmin>>(
        "/developer/auth/me",
      );
    if (!data.response) {
      throw new Error(data.message || "Không thể tải thông tin developer.");
    }
    return data.response;
  },

  async getOverview(): Promise<DeveloperOverview> {
    const { data } = await developerHttpClient.get<
      ApiEnvelope<DeveloperOverview>
    >("/developer/overview");
    if (!data.response) {
      throw new Error(data.message || "Không thể tải thống kê hệ thống.");
    }
    return data.response;
  },

  async getUsers(
    query?: ListQuery & { search?: string },
  ): Promise<DeveloperUserListResponse> {
    const { data } = await developerHttpClient.get<
      ApiEnvelope<DeveloperUserListResponse>
    >("/developer/users", {
      params: query || {},
    });
    if (!data.response) {
      throw new Error(data.message || "Không thể tải danh sách user.");
    }
    return data.response;
  },

  async getPermissions(
    query?: ListQuery & { search?: string; module?: string },
  ): Promise<DeveloperPermissionListResponse> {
    const { data } = await developerHttpClient.get<
      ApiEnvelope<DeveloperPermissionListResponse>
    >("/developer/permissions", {
      params: query || {},
    });
    if (!data.response) {
      throw new Error(data.message || "Không thể tải danh sách quyền.");
    }
    return data.response;
  },

  async updatePermissionDescription(
    permissionCode: string,
    payload: DeveloperPermissionUpdatePayload,
  ): Promise<DeveloperPermission> {
    const { data } = await developerHttpClient.patch<
      ApiEnvelope<DeveloperPermission>
    >(
      `/developer/permissions/${encodeURIComponent(permissionCode)}/description`,
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật mô tả quyền.");
    }
    return data.response;
  },

  async updateUserSubscription(
    userId: number,
    payload: DeveloperUserPackageUpdatePayload,
  ): Promise<DeveloperUser> {
    const { data } = await developerHttpClient.put<ApiEnvelope<DeveloperUser>>(
      `/developer/users/${userId}/subscription`,
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật gói user.");
    }
    return data.response;
  },

  async getPlans(query?: ListQuery): Promise<PlanListResponse> {
    const { data } = await developerHttpClient.get<
      ApiEnvelope<PlanListResponse>
    >("/developer/plans", {
      params: { include_inactive: true, ...(query || {}) },
    });
    if (!data.response) {
      throw new Error(data.message || "Không thể tải danh sách gói.");
    }
    return data.response;
  },

  async createPlan(payload: SaasPackageUpsertPayload): Promise<SaasPackage> {
    const { data } = await developerHttpClient.post<ApiEnvelope<SaasPackage>>(
      "/developer/plans",
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể tạo gói.");
    }
    return data.response;
  },

  async updatePlan(
    planId: number,
    payload: SaasPackageUpsertPayload,
  ): Promise<SaasPackage> {
    const { data } = await developerHttpClient.put<ApiEnvelope<SaasPackage>>(
      `/developer/plans/${planId}`,
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật gói.");
    }
    return data.response;
  },

  async getLandingSections(
    query?: ListQuery,
  ): Promise<LandingSectionListResponse> {
    const { data } = await developerHttpClient.get<
      ApiEnvelope<LandingSectionListResponse>
    >("/developer/landing-sections", {
      params: { page_slug: "home", locale: "vi-VN", ...(query || {}) },
    });
    if (!data.response) {
      throw new Error(data.message || "Không thể tải nội dung landing page.");
    }
    return data.response;
  },

  async createLandingSection(
    payload: LandingSectionUpsertPayload,
  ): Promise<LandingSection> {
    const { data } = await developerHttpClient.post<
      ApiEnvelope<LandingSection>
    >("/developer/landing-sections", payload);
    if (!data.response) {
      throw new Error(data.message || "Không thể tạo section.");
    }
    return data.response;
  },

  async updateLandingSection(
    sectionId: number,
    payload: LandingSectionUpsertPayload,
  ): Promise<LandingSection> {
    const { data } = await developerHttpClient.put<ApiEnvelope<LandingSection>>(
      `/developer/landing-sections/${sectionId}`,
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật section.");
    }
    return data.response;
  },
};
