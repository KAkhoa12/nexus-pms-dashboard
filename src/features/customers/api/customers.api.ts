import type {
  ApiEnvelope,
  PaginationMeta,
  PaginatedResponse,
} from "@/features/auth/types";
import type { DeletedMode } from "@/features/ops/types";
import { httpClient } from "@/services/http/client";
import { toPaginated } from "@/services/http/pagination";

export type CustomerType = "renter" | "member";
export type CustomerLeaseState = "NOT_RENTED" | "ACTIVE" | "PAST";
export type CustomerRentStateFilter = "all" | "not_rented" | "active" | "past";
export type CustomerTypeFilter = "all" | CustomerType;

export type CustomerListItem = {
  id: number;
  customerType: CustomerType;
  full_name: string;
  phone: string;
  email: string | null;
  identity_type: string | null;
  id_number: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  address: string | null;
  relation: string | null;
  renter_id: number | null;
  primary_renter_name: string | null;
  lease_state: CustomerLeaseState;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type CustomerListItemResponse = {
  id: number;
  customer_type: CustomerType;
  full_name: string;
  phone: string;
  email: string | null;
  identity_type: string | null;
  id_number: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  address: string | null;
  relation: string | null;
  renter_id: number | null;
  primary_renter_name: string | null;
  lease_state: CustomerLeaseState;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CustomerUploadResult = {
  object_name: string;
  file_name: string;
  file_url: string;
  access_url: string;
  mime_type: string | null;
  size_bytes: number;
  is_image: boolean;
};

export type CustomerPrimaryRenter = {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  identity_type: string | null;
  id_number: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  address: string | null;
};

type CustomerDetailResponse = {
  customer: CustomerListItemResponse;
  primary_renter: CustomerPrimaryRenter | null;
  companions: CustomerListItemResponse[];
};

export type CustomerDetail = {
  customer: CustomerListItem;
  primaryRenter: CustomerPrimaryRenter | null;
  companions: CustomerListItem[];
};

function toCustomerItem(item: CustomerListItemResponse): CustomerListItem {
  return {
    id: item.id,
    customerType: item.customer_type,
    full_name: item.full_name,
    phone: item.phone,
    email: item.email,
    identity_type: item.identity_type,
    id_number: item.id_number,
    avatar_url: item.avatar_url,
    date_of_birth: item.date_of_birth,
    address: item.address,
    renter_id: item.renter_id,
    relation: item.relation,
    primary_renter_name: item.primary_renter_name,
    lease_state: item.lease_state,
    created_at: item.created_at,
    updated_at: item.updated_at,
    deleted_at: item.deleted_at,
  };
}

export const customersApi = {
  async listCustomers(params?: {
    mode?: DeletedMode;
    page?: number;
    itemsPerPage?: number;
    searchKey?: string;
    customerType?: CustomerTypeFilter;
    rentState?: CustomerRentStateFilter;
  }): Promise<{
    items: CustomerListItem[];
    pagination: PaginationMeta;
  }> {
    const { data } = await httpClient.get<
      ApiEnvelope<PaginatedResponse<CustomerListItemResponse>>
    >("/customers", {
      params: {
        deleted_mode: params?.mode ?? "active",
        page: params?.page ?? 1,
        items_per_page: params?.itemsPerPage ?? 200,
        search_key: params?.searchKey || undefined,
        customer_type: params?.customerType ?? "all",
        rent_state: params?.rentState ?? "all",
      },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải danh sách khách hàng.");
    const paginated = toPaginated(data.response);
    return {
      items: paginated.items.map(toCustomerItem),
      pagination: paginated.pagination,
    };
  },

  async createCustomer(payload: {
    customerType: CustomerType;
    full_name: string;
    phone: string;
    identity_type?: string;
    id_number?: string;
    email?: string;
    avatar_url?: string;
    date_of_birth?: string;
    address?: string;
    relation?: string;
    renter_id?: number;
  }): Promise<CustomerListItem> {
    const { data } = await httpClient.post<
      ApiEnvelope<CustomerListItemResponse>
    >("/customers", {
      customer_type: payload.customerType,
      full_name: payload.full_name,
      phone: payload.phone,
      identity_type: payload.identity_type,
      id_number: payload.id_number,
      email: payload.email,
      avatar_url: payload.avatar_url,
      date_of_birth: payload.date_of_birth,
      address: payload.address,
      relation: payload.relation,
      renter_id: payload.renter_id,
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tạo khách hàng.");
    return toCustomerItem(data.response);
  },

  async getCustomerDetail(
    customerType: CustomerType,
    customerId: number,
  ): Promise<CustomerDetail> {
    const { data } = await httpClient.get<ApiEnvelope<CustomerDetailResponse>>(
      `/customers/${customerType}/${customerId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tải chi tiết khách hàng.");
    return {
      customer: toCustomerItem(data.response.customer),
      primaryRenter: data.response.primary_renter,
      companions: data.response.companions.map(toCustomerItem),
    };
  },

  async addCompanion(
    customerType: CustomerType,
    customerId: number,
    payload: {
      full_name: string;
      phone: string;
      identity_type?: string;
      id_number?: string;
      email?: string;
      avatar_url?: string;
      date_of_birth?: string;
      address?: string;
      relation?: string;
    },
  ): Promise<CustomerListItem> {
    const { data } = await httpClient.post<
      ApiEnvelope<CustomerListItemResponse>
    >(`/customers/${customerType}/${customerId}/companions`, payload);
    if (!data.response)
      throw new Error(data.message || "Không thể thêm người thuê cùng.");
    return toCustomerItem(data.response);
  },

  async uploadAvatar(file: File): Promise<CustomerUploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await httpClient.post<ApiEnvelope<CustomerUploadResult>>(
      "/customers/uploads",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể tải ảnh khách hàng.");
    }
    return data.response;
  },
};
