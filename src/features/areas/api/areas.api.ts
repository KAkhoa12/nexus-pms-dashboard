import { httpClient } from "@/services/http/client";
import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type { Area, DeletedMode } from "@/features/ops/types";
import { toPaginated } from "@/services/http/pagination";

type DeleteResult = { deleted: boolean };

export const areasApi = {
  async list(params: {
    mode: DeletedMode;
    page: number;
    itemsPerPage: number;
    branchId?: number;
    searchKey?: string;
  }): Promise<PaginatedResponse<Area>> {
    const { data } = await httpClient.get<
      ApiEnvelope<Area[] | PaginatedResponse<Area>>
    >("/areas", {
      params: {
        deleted_mode: params.mode,
        page: params.page,
        items_per_page: params.itemsPerPage,
        brandid: params.branchId,
        search_key: params.searchKey,
      },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải khu vực.");
    return toPaginated(data.response);
  },
  async create(payload: {
    branch_id: number;
    name: string;
    address?: string;
  }): Promise<Area> {
    const { data } = await httpClient.post<ApiEnvelope<Area>>(
      "/areas",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo khu vực.");
    return data.response;
  },
  async update(
    areaId: number,
    payload: { branch_id?: number; name?: string; address?: string },
  ): Promise<Area> {
    const { data } = await httpClient.put<ApiEnvelope<Area>>(
      `/areas/${areaId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật khu vực.");
    return data.response;
  },
  async remove(areaId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/areas/${areaId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa khu vực.");
    return data.response;
  },
  async removeHard(areaId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/areas/${areaId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa cứng khu vực.");
    return data.response;
  },
};
