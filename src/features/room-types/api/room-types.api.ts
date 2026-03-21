import { httpClient } from "@/services/http/client";
import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type { DeletedMode, RoomType } from "@/features/ops/types";
import { toPaginated } from "@/services/http/pagination";

type DeleteResult = { deleted: boolean };

export const roomTypesApi = {
  async list(mode: DeletedMode): Promise<RoomType[]> {
    const { data } = await httpClient.get<
      ApiEnvelope<RoomType[] | PaginatedResponse<RoomType>>
    >("/room-types", {
      params: { deleted_mode: mode, page: 1, items_per_page: 200 },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải loại phòng.");
    return toPaginated(data.response).items;
  },
  async create(payload: {
    name: string;
    base_price: string;
    pricing_mode: "FIXED" | "PER_PERSON";
    default_occupancy: number;
    max_occupancy: number;
  }): Promise<RoomType> {
    const { data } = await httpClient.post<ApiEnvelope<RoomType>>(
      "/room-types",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo loại phòng.");
    return data.response;
  },
  async update(
    roomTypeId: number,
    payload: {
      name?: string;
      base_price?: string;
      pricing_mode?: "FIXED" | "PER_PERSON";
      default_occupancy?: number;
      max_occupancy?: number;
    },
  ): Promise<RoomType> {
    const { data } = await httpClient.put<ApiEnvelope<RoomType>>(
      `/room-types/${roomTypeId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật loại phòng.");
    return data.response;
  },
  async remove(roomTypeId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/room-types/${roomTypeId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa loại phòng.");
    return data.response;
  },
  async removeHard(roomTypeId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/room-types/${roomTypeId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa cứng loại phòng.");
    return data.response;
  },
};
