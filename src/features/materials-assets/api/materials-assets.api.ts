import type { ApiEnvelope, PaginatedResponse } from "@/features/auth/types";
import { httpClient } from "@/services/http/client";
import { toPaginated } from "@/services/http/pagination";

export type MaterialAssetType = {
  id: number;
  tenant_id: number;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MaterialAssetImage = {
  id: number;
  image_url: string;
  caption: string | null;
  sort_order: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type MaterialAsset = {
  id: number;
  tenant_id: number;
  room_id: number;
  renter_id: number | null;
  owner_scope: "ROOM" | "RENTER" | string;
  asset_type_id: number;
  name: string;
  identifier: string | null;
  quantity: string | number;
  unit: string | null;
  status: string;
  condition_status: string;
  acquired_at: string | null;
  metadata_json: string | null;
  note: string | null;
  primary_image_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  asset_type_name: string | null;
  room_code: string | null;
  renter_full_name: string | null;
  images: MaterialAssetImage[];
};

export type MaterialAssetUploadResult = {
  object_name: string;
  file_name: string;
  file_url: string;
  access_url: string;
  mime_type: string | null;
  size_bytes: number;
  is_image: boolean;
};

type DeleteResult = { deleted: boolean };

export const materialsAssetsApi = {
  async listTypes(params: {
    mode: "active" | "trash" | "all";
    page: number;
    itemsPerPage: number;
    searchKey?: string;
  }): Promise<PaginatedResponse<MaterialAssetType>> {
    const { data } = await httpClient.get<
      ApiEnvelope<MaterialAssetType[] | PaginatedResponse<MaterialAssetType>>
    >("/materials-assets/types", {
      params: {
        deleted_mode: params.mode,
        page: params.page,
        items_per_page: params.itemsPerPage,
        search_key: params.searchKey,
      },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải danh sách loại tài sản.");
    return toPaginated(data.response);
  },

  async createType(payload: { name: string }): Promise<MaterialAssetType> {
    const { data } = await httpClient.post<ApiEnvelope<MaterialAssetType>>(
      "/materials-assets/types",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo loại tài sản.");
    return data.response;
  },

  async updateType(
    typeId: number,
    payload: { name?: string },
  ): Promise<MaterialAssetType> {
    const { data } = await httpClient.put<ApiEnvelope<MaterialAssetType>>(
      `/materials-assets/types/${typeId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật loại tài sản.");
    return data.response;
  },

  async removeType(typeId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/materials-assets/types/${typeId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa loại tài sản.");
    return data.response;
  },

  async removeTypeHard(typeId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/materials-assets/types/${typeId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa vĩnh viễn loại tài sản.");
    return data.response;
  },

  async list(params: {
    mode: "active" | "trash" | "all";
    page: number;
    itemsPerPage: number;
    searchKey?: string;
    roomId?: number;
    renterId?: number;
    ownerScope?: "ROOM" | "RENTER";
    assetTypeId?: number;
  }): Promise<PaginatedResponse<MaterialAsset>> {
    const { data } = await httpClient.get<
      ApiEnvelope<MaterialAsset[] | PaginatedResponse<MaterialAsset>>
    >("/materials-assets", {
      params: {
        deleted_mode: params.mode,
        page: params.page,
        items_per_page: params.itemsPerPage,
        search_key: params.searchKey,
        room_id: params.roomId,
        renter_id: params.renterId,
        owner_scope: params.ownerScope,
        asset_type_id: params.assetTypeId,
      },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải danh sách tài sản.");
    return toPaginated(data.response);
  },

  async create(payload: {
    room_id?: number;
    renter_id?: number;
    owner_scope?: "ROOM" | "RENTER";
    asset_type_id: number;
    name: string;
    identifier?: string | null;
    quantity?: number;
    unit?: string | null;
    status?: string;
    condition_status?: string;
    acquired_at?: string | null;
    metadata_json?: string | null;
    note?: string | null;
    primary_image_url?: string | null;
    image_urls?: string[];
  }): Promise<MaterialAsset> {
    const { data } = await httpClient.post<ApiEnvelope<MaterialAsset>>(
      "/materials-assets",
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể tạo tài sản.");
    return data.response;
  },

  async uploadImage(file: File): Promise<MaterialAssetUploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await httpClient.post<
      ApiEnvelope<MaterialAssetUploadResult>
    >("/materials-assets/uploads", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    if (!data.response)
      throw new Error(data.message || "Không thể tải ảnh lên MinIO.");
    return data.response;
  },

  async update(
    assetId: number,
    payload: Partial<{
      room_id: number;
      renter_id: number;
      owner_scope: "ROOM" | "RENTER";
      asset_type_id: number;
      name: string;
      identifier: string | null;
      quantity: number;
      unit: string | null;
      status: string;
      condition_status: string;
      acquired_at: string | null;
      metadata_json: string | null;
      note: string | null;
      primary_image_url: string | null;
      image_urls: string[];
    }>,
  ): Promise<MaterialAsset> {
    const { data } = await httpClient.put<ApiEnvelope<MaterialAsset>>(
      `/materials-assets/${assetId}`,
      payload,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể cập nhật tài sản.");
    return data.response;
  },

  async remove(assetId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/materials-assets/${assetId}`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa tài sản.");
    return data.response;
  },

  async removeHard(assetId: number): Promise<DeleteResult> {
    const { data } = await httpClient.delete<ApiEnvelope<DeleteResult>>(
      `/materials-assets/${assetId}/hard`,
    );
    if (!data.response)
      throw new Error(data.message || "Không thể xóa vĩnh viễn tài sản.");
    return data.response;
  },
};
