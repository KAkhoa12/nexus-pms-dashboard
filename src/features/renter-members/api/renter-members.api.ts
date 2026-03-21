import { httpClient } from "@/services/http/client";
import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type { DeletedMode, RenterMember } from "@/features/ops/types";
import { toPaginated } from "@/services/http/pagination";

type DeleteResult = { deleted: boolean };

export const renterMembersApi = {
  async list(mode: DeletedMode): Promise<RenterMember[]> {
    const { data } = await httpClient.get<
      ApiEnvelope<RenterMember[] | PaginatedResponse<RenterMember>>
    >("/renter-members", {
      params: { deleted_mode: mode, page: 1, items_per_page: 200 },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải người đi cùng.");
    return toPaginated(data.response).items;
  },
  async create(payload: {
    renter_id: number;
    full_name: string;
    phone: string;
    identity_type?: string;
    id_number?: string;
    email?: string;
    avatar_url?: string;
    date_of_birth?: string;
    address?: string;
    relation?: string;
  }): Promise<RenterMember> {
    const { data } = await httpClient.post<ApiEnvelope<RenterMember>>(
      "/renter-members",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo người đi cùng.");
    return data.response;
  },
  async update(
    memberId: number,
    payload: {
      renter_id?: number;
      full_name?: string;
      phone?: string;
      identity_type?: string;
      id_number?: string;
      email?: string;
      avatar_url?: string;
      date_of_birth?: string;
      address?: string;
      relation?: string;
    },
  ): Promise<RenterMember> {
    const { data } = await httpClient.put<ApiEnvelope<RenterMember>>(
      `/renter-members/${memberId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật người đi cùng.");
    return data.response;
  },
  async remove(memberId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/renter-members/${memberId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa người đi cùng.");
    return data.response;
  },
  async removeHard(memberId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/renter-members/${memberId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa cứng người đi cùng.");
    return data.response;
  },
};
