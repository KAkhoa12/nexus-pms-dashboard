import { httpClient } from "@/services/http/client";
import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type { Branch, DeletedMode } from "@/features/ops/types";
import { toPaginated } from "@/services/http/pagination";

type DeleteResult = { deleted: boolean };

export const branchesApi = {
  async list(
    mode: DeletedMode = "active",
    options?: {
      page?: number;
      itemsPerPage?: number;
      searchKey?: string;
    },
  ): Promise<Branch[]> {
    const { data } = await httpClient.get<
      ApiEnvelope<Branch[] | PaginatedResponse<Branch>>
    >("/branches", {
      params: {
        deleted_mode: mode,
        page: options?.page ?? 1,
        items_per_page: options?.itemsPerPage ?? 200,
        search_key: options?.searchKey,
      },
    });
    if (!data.response) {
      throw new Error(data.message || "Không thể tải danh sách chi nhánh.");
    }
    return toPaginated(data.response).items;
  },
  async create(payload: { name: string }): Promise<Branch> {
    const { data } = await httpClient.post<ApiEnvelope<Branch>>(
      "/branches",
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể thêm chi nhánh.");
    }
    return data.response;
  },
  async update(
    branchId: number,
    payload: { name?: string },
  ): Promise<Branch> {
    const { data } = await httpClient.put<ApiEnvelope<Branch>>(
      `/branches/${branchId}`,
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật chi nhánh.");
    }
    return data.response;
  },
  async remove(branchId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/branches/${branchId}`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể xóa chi nhánh.");
    }
    return data.response;
  },
  async removeHard(branchId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/branches/${branchId}/hard`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể xóa cứng chi nhánh.");
    }
    return data.response;
  },
};
