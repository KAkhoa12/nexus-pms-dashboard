import { httpClient } from "@/services/http/client";
import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type { Building, DeletedMode } from "@/features/ops/types";
import { toPaginated } from "@/services/http/pagination";

type DeleteResult = { deleted: boolean };

export const buildingsApi = {
  async list(mode: DeletedMode): Promise<Building[]> {
    const { data } = await httpClient.get<
      ApiEnvelope<Building[] | PaginatedResponse<Building>>
    >("/buildings", {
      params: { deleted_mode: mode, page: 1, items_per_page: 200 },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải tòa nhà.");
    return toPaginated(data.response).items;
  },
  async create(payload: {
    area_id: number;
    name: string;
    total_floors: number;
  }): Promise<Building> {
    const { data } = await httpClient.post<ApiEnvelope<Building>>(
      "/buildings",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo tòa nhà.");
    return data.response;
  },
  async update(
    buildingId: number,
    payload: { area_id?: number; name?: string; total_floors?: number },
  ): Promise<Building> {
    const { data } = await httpClient.put<ApiEnvelope<Building>>(
      `/buildings/${buildingId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật tòa nhà.");
    return data.response;
  },
  async remove(buildingId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/buildings/${buildingId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa tòa nhà.");
    return data.response;
  },
  async removeHard(buildingId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/buildings/${buildingId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa cứng tòa nhà.");
    return data.response;
  },
};
