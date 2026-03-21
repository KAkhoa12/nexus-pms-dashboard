import { httpClient } from "@/services/http/client";
import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type { DeletedMode, Deposit } from "@/features/ops/types";
import { toPaginated } from "@/services/http/pagination";

type DeleteResult = { deleted: boolean };

export const depositsApi = {
  async list(params: {
    mode: DeletedMode;
    page: number;
    itemsPerPage: number;
    roomId?: number;
    leaseId?: number;
  }): Promise<PaginatedResponse<Deposit>> {
    const { data } = await httpClient.get<
      ApiEnvelope<Deposit[] | PaginatedResponse<Deposit>>
    >("/deposits", {
      params: {
        deleted_mode: params.mode,
        page: params.page,
        items_per_page: params.itemsPerPage,
        room_id: params.roomId,
        lease_id: params.leaseId,
      },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải danh sách đặt cọc.");
    return toPaginated(data.response);
  },
  async create(payload: {
    room_id: number;
    renter_id?: number;
    lease_id?: number;
    amount: string;
    method: "CASH" | "BANK" | "QR";
    status?: "HELD" | "REFUNDED" | "FORFEITED";
    paid_at?: string;
    content_html?: string;
  }): Promise<Deposit> {
    const { data } = await httpClient.post<ApiEnvelope<Deposit>>(
      "/deposits",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo phiếu đặt cọc.");
    return data.response;
  },
  async getById(depositId: number): Promise<Deposit> {
    const { data } = await httpClient.get<ApiEnvelope<Deposit>>(
      `/deposits/${depositId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tải chi tiết phiếu đặt cọc.");
    return data.response;
  },
  async update(
    depositId: number,
    payload: {
      renter_id?: number;
      lease_id?: number;
      amount?: string;
      method?: "CASH" | "BANK" | "QR";
      status?: "HELD" | "REFUNDED" | "FORFEITED";
      paid_at?: string;
      content_html?: string;
    },
  ): Promise<Deposit> {
    const { data } = await httpClient.put<ApiEnvelope<Deposit>>(
      `/deposits/${depositId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật phiếu đặt cọc.");
    return data.response;
  },
  async remove(depositId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/deposits/${depositId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa phiếu đặt cọc.");
    return data.response;
  },
  async removeHard(depositId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/deposits/${depositId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa cứng phiếu đặt cọc.");
    return data.response;
  },
};
