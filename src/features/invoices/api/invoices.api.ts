import { httpClient } from "@/services/http/client";
import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type { DeletedMode, Invoice } from "@/features/ops/types";
import { toPaginated } from "@/services/http/pagination";

type DeleteResult = { deleted: boolean };

export const invoicesApi = {
  async list(mode: DeletedMode): Promise<Invoice[]> {
    const { data } = await httpClient.get<
      ApiEnvelope<Invoice[] | PaginatedResponse<Invoice>>
    >("/invoices", {
      params: { deleted_mode: mode, page: 1, items_per_page: 200 },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải hóa đơn.");
    return toPaginated(data.response).items;
  },
  async create(payload: {
    branch_id: number;
    room_id: number;
    renter_id: number;
    period_month: string;
    due_date: string;
    total_amount: string;
    paid_amount: string;
    status: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
    content: string;
    content_html: string;
    items: Array<{
      fee_type_id?: number;
      description: string;
      quantity: string;
      unit_price: string;
      amount: string;
    }>;
  }): Promise<Invoice> {
    const { data } = await httpClient.post<ApiEnvelope<Invoice>>(
      "/invoices",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo hóa đơn.");
    return data.response;
  },
  async update(
    invoiceId: number,
    payload: {
      branch_id?: number;
      room_id?: number;
      renter_id?: number;
      period_month?: string;
      due_date?: string;
      total_amount?: string;
      paid_amount?: string;
      status?: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
      content?: string;
      content_html?: string;
      items?: Array<{
        fee_type_id?: number;
        description: string;
        quantity: string;
        unit_price: string;
        amount: string;
      }>;
    },
  ): Promise<Invoice> {
    const { data } = await httpClient.put<ApiEnvelope<Invoice>>(
      `/invoices/${invoiceId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật hóa đơn.");
    return data.response;
  },
  async remove(invoiceId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/invoices/${invoiceId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa hóa đơn.");
    return data.response;
  },
  async removeHard(invoiceId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/invoices/${invoiceId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa cứng hóa đơn.");
    return data.response;
  },
};
