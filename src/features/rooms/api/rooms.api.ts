import { httpClient } from "@/services/http/client";
import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type { DeletedMode, Room } from "@/features/ops/types";
import { toPaginated } from "@/services/http/pagination";

type DeleteResult = { deleted: boolean };

export const roomsApi = {
  async list(params: {
    mode: DeletedMode;
    page: number;
    itemsPerPage: number;
    searchKey?: string;
  }): Promise<PaginatedResponse<Room>> {
    const { data } = await httpClient.get<
      ApiEnvelope<Room[] | PaginatedResponse<Room>>
    >("/rooms", {
      params: {
        deleted_mode: params.mode,
        page: params.page,
        items_per_page: params.itemsPerPage,
        search_key: params.searchKey,
      },
    });
    if (!data.response) throw new Error(data.message || "Không thể tải phòng.");
    return toPaginated(data.response);
  },
  async create(payload: {
    branch_id: number;
    area_id: number;
    building_id: number;
    room_type_id: number;
    floor_number: number;
    code: string;
    current_status: "VACANT" | "DEPOSITED" | "RENTED" | "MAINTENANCE";
    current_price: string;
  }): Promise<Room> {
    const { data } = await httpClient.post<ApiEnvelope<Room>>(
      "/rooms",
      payload,
    );
    if (!data.response) throw new Error(data.message || "Không thể tạo phòng.");
    return data.response;
  },
  async update(
    roomId: number,
    payload: {
      branch_id?: number;
      area_id?: number;
      building_id?: number;
      room_type_id?: number;
      floor_number?: number;
      code?: string;
      current_status?: "VACANT" | "DEPOSITED" | "RENTED" | "MAINTENANCE";
      current_price?: string;
    },
  ): Promise<Room> {
    const { data } = await httpClient.put<ApiEnvelope<Room>>(
      `/rooms/${roomId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật phòng.");
    return data.response;
  },
  async remove(roomId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/rooms/${roomId}`,
    );
    if (!data.response) throw new Error(data.message || "Không thể xóa phòng.");
    return data.response;
  },
  async removeHard(roomId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/rooms/${roomId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa cứng phòng.");
    return data.response;
  },
};
