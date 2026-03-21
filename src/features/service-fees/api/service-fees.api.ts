import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import { httpClient } from "@/services/http/client";
import { toPaginated } from "@/services/http/pagination";

export type ServiceFee = {
  id: number;
  tenant_id: number;
  code: string;
  name: string;
  unit: string | null;
  default_quantity: string | number;
  default_price: string | number | null;
  billing_cycle: "MONTHLY" | "ONE_TIME" | "CUSTOM_MONTHS";
  cycle_interval_months: number | null;
  charge_mode: "FIXED" | "USAGE";
  description: string | null;
  is_active: boolean;
};

type DeleteResult = { deleted: boolean };

export const serviceFeesApi = {
  async list(params: {
    mode: "active" | "trash" | "all";
    page: number;
    itemsPerPage: number;
    searchKey?: string;
    billingCycle?: "MONTHLY" | "ONE_TIME" | "CUSTOM_MONTHS";
    chargeMode?: "FIXED" | "USAGE";
  }): Promise<PaginatedResponse<ServiceFee>> {
    const { data } = await httpClient.get<
      ApiEnvelope<ServiceFee[] | PaginatedResponse<ServiceFee>>
    >("/service-fees", {
      params: {
        deleted_mode: params.mode,
        page: params.page,
        items_per_page: params.itemsPerPage,
        search_key: params.searchKey,
        billing_cycle: params.billingCycle,
        charge_mode: params.chargeMode,
      },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải danh sách phí thu.");
    return toPaginated(data.response);
  },

  async create(payload: {
    code?: string | null;
    name: string;
    unit?: string | null;
    default_quantity?: number;
    default_price?: number | null;
    billing_cycle?: "MONTHLY" | "ONE_TIME" | "CUSTOM_MONTHS";
    cycle_interval_months?: number | null;
    charge_mode?: "FIXED" | "USAGE";
    description?: string | null;
    is_active?: boolean;
  }): Promise<ServiceFee> {
    const { data } = await httpClient.post<ApiEnvelope<ServiceFee>>(
      "/service-fees",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo phí thu.");
    return data.response;
  },

  async update(
    feeId: number,
    payload: Partial<{
      code: string;
      name: string;
      unit: string | null;
      default_quantity: number;
      default_price: number | null;
      billing_cycle: "MONTHLY" | "ONE_TIME" | "CUSTOM_MONTHS";
      cycle_interval_months: number | null;
      charge_mode: "FIXED" | "USAGE";
      description: string | null;
      is_active: boolean;
    }>,
  ): Promise<ServiceFee> {
    const { data } = await httpClient.put<ApiEnvelope<ServiceFee>>(
      `/service-fees/${feeId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật phí thu.");
    return data.response;
  },

  async remove(feeId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/service-fees/${feeId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa phí thu.");
    return data.response;
  },

  async removeHard(feeId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/service-fees/${feeId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa vĩnh viễn phí thu.");
    return data.response;
  },
};
