import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import { httpClient } from "@/services/http/client";
import { toPaginated } from "@/services/http/pagination";

export type CustomerAppointment = {
  id: number;
  tenant_id: number;
  branch_id: number | null;
  room_id: number | null;
  contact_name: string;
  phone: string;
  email: string | null;
  note: string | null;
  start_at: string;
  end_at: string;
  status: string;
  source: string | null;
  assigned_user_id: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type DeleteResult = { deleted: boolean };

export const customerAppointmentsApi = {
  async list(params: {
    mode: "active" | "trash" | "all";
    page: number;
    itemsPerPage: number;
    searchKey?: string;
  }): Promise<PaginatedResponse<CustomerAppointment>> {
    const { data } = await httpClient.get<
      ApiEnvelope<CustomerAppointment[] | PaginatedResponse<CustomerAppointment>>
    >("/customer-appointments", {
      params: {
        deleted_mode: params.mode,
        page: params.page,
        items_per_page: params.itemsPerPage,
        search_key: params.searchKey,
      },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải danh sách khách hẹn.");
    return toPaginated(data.response);
  },

  async create(payload: {
    branch_id?: number | null;
    room_id?: number | null;
    contact_name: string;
    phone: string;
    email?: string | null;
    note?: string | null;
    start_at: string;
    end_at: string;
    status?: string;
    source?: string | null;
    assigned_user_id?: number | null;
  }): Promise<CustomerAppointment> {
    const { data } = await httpClient.post<ApiEnvelope<CustomerAppointment>>(
      "/customer-appointments",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo khách hẹn.");
    return data.response;
  },

  async update(
    appointmentId: number,
    payload: Partial<{
      branch_id: number | null;
      room_id: number | null;
      contact_name: string;
      phone: string;
      email: string | null;
      note: string | null;
      start_at: string;
      end_at: string;
      status: string;
      source: string | null;
      assigned_user_id: number | null;
    }>,
  ): Promise<CustomerAppointment> {
    const { data } = await httpClient.put<ApiEnvelope<CustomerAppointment>>(
      `/customer-appointments/${appointmentId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật khách hẹn.");
    return data.response;
  },

  async remove(appointmentId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/customer-appointments/${appointmentId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa khách hẹn.");
    return data.response;
  },

  async removeHard(appointmentId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/customer-appointments/${appointmentId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa vĩnh viễn khách hẹn.");
    return data.response;
  },
};
