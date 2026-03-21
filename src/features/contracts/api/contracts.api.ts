import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import type { Lease } from "@/features/ops/types";
import { httpClient } from "@/services/http/client";
import { toPaginated } from "@/services/http/pagination";

export type LeaseInstallmentItem = {
  id: number;
  description: string;
  quantity: string;
  unit_price: string;
  amount: string;
};

export type LeaseInstallment = {
  id: number;
  installment_no: number | null;
  installment_total: number | null;
  period_month: string;
  due_date: string;
  reminder_at: string | null;
  total_amount: string;
  paid_amount: string;
  status: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
  content: string;
  content_html: string;
  items: LeaseInstallmentItem[];
};

export type LeaseDetail = {
  lease: Lease;
  renter: {
    id: number;
    full_name: string;
    phone: string;
    email: string | null;
  } | null;
  room: {
    id: number;
    code: string;
    branch_id: number;
    area_id: number;
    building_id: number;
    floor_number: number;
    current_status: "VACANT" | "DEPOSITED" | "RENTED" | "MAINTENANCE";
  } | null;
  installments: LeaseInstallment[];
};

export const contractsApi = {
  async list(params: {
    mode: "active" | "trash" | "all";
    page: number;
    itemsPerPage: number;
    roomId?: number;
    renterId?: number;
    status?: "ACTIVE" | "ENDED" | "CANCELLED";
    searchKey?: string;
  }): Promise<PaginatedResponse<Lease>> {
    const { data } = await httpClient.get<
      ApiEnvelope<Lease[] | PaginatedResponse<Lease>>
    >("/leases", {
      params: {
        deleted_mode: params.mode,
        page: params.page,
        items_per_page: params.itemsPerPage,
        room_id: params.roomId,
        renter_id: params.renterId,
        status_filter: params.status,
        search_key: params.searchKey,
      },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải danh sách hợp đồng thuê.");
    return toPaginated(data.response);
  },

  async create(payload: {
    branch_id: number;
    room_id: number;
    renter_id: number;
    lease_years: number;
    handover_at: string;
    start_date?: string;
    end_date?: string;
    rent_price: string;
    pricing_mode: "FIXED" | "PER_PERSON";
    status?: "ACTIVE" | "ENDED" | "CANCELLED";
    content?: string;
    content_html?: string;
    security_deposit_amount?: string;
    security_deposit_paid_amount?: string;
    security_deposit_payment_method?: "CASH" | "BANK" | "QR";
    security_deposit_paid_at?: string;
    security_deposit_note?: string;
    mark_room_as_deposited?: boolean;
    selected_service_fees?: Array<{
      service_fee_id: number;
      quantity: number;
      unit_price?: number;
    }>;
  }): Promise<Lease> {
    const { data } = await httpClient.post<ApiEnvelope<Lease>>(
      "/leases",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo hợp đồng thuê.");
    return data.response;
  },

  async update(
    leaseId: number,
    payload: {
      lease_years?: number;
      handover_at?: string;
      start_date?: string;
      end_date?: string;
      rent_price?: string;
      pricing_mode?: "FIXED" | "PER_PERSON";
      status?: "ACTIVE" | "ENDED" | "CANCELLED";
      content?: string;
      content_html?: string;
      security_deposit_amount?: string;
      security_deposit_paid_amount?: string;
      security_deposit_payment_method?: "CASH" | "BANK" | "QR";
      security_deposit_paid_at?: string;
      security_deposit_note?: string;
    },
  ): Promise<Lease> {
    const { data } = await httpClient.put<ApiEnvelope<Lease>>(
      `/leases/${leaseId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật hợp đồng thuê.");
    return data.response;
  },

  async get(leaseId: number): Promise<Lease> {
    const { data } = await httpClient.get<ApiEnvelope<Lease>>(
      `/leases/${leaseId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tải chi tiết hợp đồng thuê.");
    return data.response;
  },

  async getDetail(leaseId: number): Promise<LeaseDetail> {
    const { data } = await httpClient.get<ApiEnvelope<LeaseDetail>>(
      `/leases/${leaseId}/detail`,
    );
    if (!data.response)
      throw new Error(
        data.message || "Không thể tải chi tiết hợp đồng và kỳ thanh toán.",
      );
    return data.response;
  },

  async updateInstallment(
    leaseId: number,
    invoiceId: number,
    payload: {
      due_date?: string;
      reminder_at?: string | null;
      status?: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
      content?: string;
      content_html?: string;
      items?: Array<{
        description: string;
        quantity: string;
        unit_price: string;
      }>;
    },
  ): Promise<LeaseInstallment> {
    const { data } = await httpClient.put<ApiEnvelope<LeaseInstallment>>(
      `/leases/${leaseId}/invoices/${invoiceId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật kỳ thanh toán.");
    return data.response;
  },

  async remove(leaseId: number): Promise<void> {
    const { data } = await httpClient.delete<ApiEnvelope<{ deleted: boolean }>>(
      `/leases/${leaseId}`,
    );
    if (!data.success) {
      throw new Error(data.message || "Không thể xóa hợp đồng thuê.");
    }
  },
};
