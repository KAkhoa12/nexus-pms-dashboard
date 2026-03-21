import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import { httpClient } from "@/services/http/client";
import { toPaginated } from "@/services/http/pagination";
import type { FormTemplate } from "@/features/form-templates/types";

type DeleteResult = { deleted: boolean };

export const formTemplatesApi = {
  async list(params: {
    mode: "active" | "trash" | "all";
    page: number;
    itemsPerPage: number;
    searchKey?: string;
  }): Promise<PaginatedResponse<FormTemplate>> {
    const { data } = await httpClient.get<
      ApiEnvelope<FormTemplate[] | PaginatedResponse<FormTemplate>>
    >("/form-templates", {
      params: {
        deleted_mode: params.mode,
        page: params.page,
        items_per_page: params.itemsPerPage,
        search_key: params.searchKey,
      },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải danh sách biểu mẫu.");
    return toPaginated(data.response);
  },

  async create(payload: {
    name: string;
    template_type: string;
    page_size: string;
    orientation: string;
    font_family: string;
    font_size: number;
    text_color: string;
    content_html: string;
    config_json?: string | null;
    is_active?: boolean;
  }): Promise<FormTemplate> {
    const { data } = await httpClient.post<ApiEnvelope<FormTemplate>>(
      "/form-templates",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo biểu mẫu.");
    return data.response;
  },

  async get(templateId: number): Promise<FormTemplate> {
    const { data } = await httpClient.get<ApiEnvelope<FormTemplate>>(
      `/form-templates/${templateId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tải chi tiết biểu mẫu.");
    return data.response;
  },

  async update(
    templateId: number,
    payload: {
      name?: string;
      template_type?: string;
      page_size?: string;
      orientation?: string;
      font_family?: string;
      font_size?: number;
      text_color?: string;
      content_html?: string;
      config_json?: string | null;
      is_active?: boolean;
    },
  ): Promise<FormTemplate> {
    const { data } = await httpClient.put<ApiEnvelope<FormTemplate>>(
      `/form-templates/${templateId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật biểu mẫu.");
    return data.response;
  },

  async remove(templateId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/form-templates/${templateId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa biểu mẫu.");
    return data.response;
  },
};
