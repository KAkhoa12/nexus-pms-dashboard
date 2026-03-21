import { httpClient } from "@/services/http/client";
import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type { DeletedMode, Renter } from "@/features/ops/types";
import { toPaginated } from "@/services/http/pagination";

type DeleteResult = { deleted: boolean };

export const rentersApi = {
  async list(mode: DeletedMode): Promise<Renter[]> {
    const { data } = await httpClient.get<
      ApiEnvelope<Renter[] | PaginatedResponse<Renter>>
    >("/renters", {
      params: { deleted_mode: mode, page: 1, items_per_page: 200 },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải người thuê.");
    return toPaginated(data.response).items;
  },
  async create(payload: {
    full_name: string;
    phone: string;
    identity_type?: string;
    id_number?: string;
    email?: string;
    avatar_url?: string;
    date_of_birth?: string;
    address?: string;
  }): Promise<Renter> {
    const { data } = await httpClient.post<ApiEnvelope<Renter>>(
      "/renters",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo người thuê.");
    return data.response;
  },
  async update(
    renterId: number,
    payload: {
      full_name?: string;
      phone?: string;
      identity_type?: string;
      id_number?: string;
      email?: string;
      avatar_url?: string;
      date_of_birth?: string;
      address?: string;
    },
  ): Promise<Renter> {
    const { data } = await httpClient.put<ApiEnvelope<Renter>>(
      `/renters/${renterId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật người thuê.");
    return data.response;
  },
  async remove(renterId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/renters/${renterId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa người thuê.");
    return data.response;
  },
  async removeHard(renterId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/renters/${renterId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa cứng người thuê.");
    return data.response;
  },
};
