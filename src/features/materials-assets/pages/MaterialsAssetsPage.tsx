import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Eye, Plus, Trash2, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PaginationMeta } from "@/features/auth/types";
import {
  materialsAssetsApi,
  type MaterialAsset,
  type MaterialAssetType,
} from "@/features/materials-assets/api/materials-assets.api";
import type { Renter, Room } from "@/features/ops/types";
import { rentersApi } from "@/features/renters/api/renters.api";
import { roomsApi } from "@/features/rooms/api/rooms.api";
import { cn } from "@/lib/utils";
import { getAccessToken } from "@/services/auth/token";
import { storage } from "@/services/storage";
import { useAuthStore } from "@/store/auth.store";

type ApiErrorBody = { message?: string };
type DeletedMode = "active" | "trash" | "all";
type MetadataEntry = { key: string; value: string };
const ACTIVE_WORKSPACE_STORAGE_KEY = "active_workspace_key";

type AssetFormState = {
  renterId: string;
  roomId: string;
  assetTypeId: string;
  name: string;
  quantity: string;
  unit: string;
  status: string;
  conditionStatus: string;
  acquiredAt: string;
  note: string;
  primaryImageUrl: string;
  imageUrls: string[];
};

const MATERIAL_ASSET_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ACTIVE", label: "Đang sử dụng" },
  { value: "INACTIVE", label: "Ngừng sử dụng" },
  { value: "LOST", label: "Thất lạc" },
  { value: "DISPOSED", label: "Thanh lý" },
];

const MATERIAL_ASSET_CONDITION_OPTIONS: Array<{
  value: string;
  label: string;
}> = [
  { value: "NEW", label: "Mới" },
  { value: "GOOD", label: "Tốt" },
  { value: "FAIR", label: "Trung bình" },
  { value: "DAMAGED", label: "Hư hỏng" },
];

function getAssetStatusLabel(status: string): string {
  return (
    MATERIAL_ASSET_STATUS_OPTIONS.find((item) => item.value === status)
      ?.label || status
  );
}

function getConditionStatusLabel(status: string): string {
  return (
    MATERIAL_ASSET_CONDITION_OPTIONS.find((item) => item.value === status)
      ?.label || status
  );
}

function getAssetStatusBadgeClass(status: string): string {
  if (status === "ACTIVE") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "INACTIVE") {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }
  if (status === "LOST") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (status === "DISPOSED") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-muted bg-muted/60 text-muted-foreground";
}

function getConditionStatusBadgeClass(status: string): string {
  if (status === "NEW") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (status === "GOOD") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "FAIR") {
    return "border-yellow-200 bg-yellow-50 text-yellow-700";
  }
  if (status === "DAMAGED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  return "border-muted bg-muted/60 text-muted-foreground";
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function toDatetimeLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function toIsoDatetime(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parsePositiveNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseMetadataEntries(
  metadataJson: string | null | undefined,
): MetadataEntry[] {
  const raw = (metadataJson || "").trim();
  if (!raw) return [{ key: "", value: "" }];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [{ key: "", value: "" }];
    }
    const entries = Object.entries(parsed as Record<string, unknown>)
      .map(([key, value]) => ({
        key,
        value:
          value === null || value === undefined
            ? ""
            : typeof value === "string"
              ? value
              : JSON.stringify(value),
      }))
      .filter((entry) => entry.key.trim().length > 0);
    return entries.length > 0 ? entries : [{ key: "", value: "" }];
  } catch {
    return [{ key: "", value: "" }];
  }
}

function buildMetadataJson(entries: MetadataEntry[]): string | null {
  const normalized = entries
    .map((entry) => ({
      key: entry.key.trim(),
      value: entry.value.trim(),
    }))
    .filter((entry) => entry.key.length > 0);
  if (normalized.length === 0) return null;
  const payload: Record<string, string> = {};
  normalized.forEach((entry) => {
    payload[entry.key] = entry.value;
  });
  return JSON.stringify(payload);
}

function resolveAssetImageUrl(
  rawUrl: string,
  accessToken: string | null,
  workspaceKey: string,
): string {
  const normalized = rawUrl.trim();
  if (!normalized) return normalized;

  const toAbsolute = (relativePath: string) =>
    new URL(relativePath, window.location.origin).toString();
  const encodedObjectName = (value: string) =>
    value
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  const withAuthToken = (urlLike: string) => {
    try {
      const parsed = new URL(urlLike, window.location.origin);
      if (accessToken && !parsed.searchParams.get("token")) {
        parsed.searchParams.set("token", accessToken);
      }
      if (workspaceKey && !parsed.searchParams.get("workspace_key")) {
        parsed.searchParams.set("workspace_key", workspaceKey);
      }
      return parsed.toString();
    } catch {
      return urlLike;
    }
  };

  if (normalized.startsWith("tenant-")) {
    return withAuthToken(
      toAbsolute(
        `/api/v1/materials-assets/files/${encodedObjectName(normalized)}`,
      ),
    );
  }

  try {
    const parsed = new URL(normalized, window.location.origin);
    if (!parsed.pathname.startsWith("/api/v1/materials-assets/files/")) {
      return normalized;
    }
    return withAuthToken(parsed.toString());
  } catch {
    return normalized;
  }
}

function buildEmptyForm(
  renters: Renter[],
  assetTypes: MaterialAssetType[],
  initialRoomId?: number | null,
): AssetFormState {
  return {
    renterId: renters[0] ? String(renters[0].id) : "",
    roomId:
      typeof initialRoomId === "number" && initialRoomId > 0
        ? String(initialRoomId)
        : "",
    assetTypeId: assetTypes[0] ? String(assetTypes[0].id) : "",
    name: "",
    quantity: "1",
    unit: "",
    status: "ACTIVE",
    conditionStatus: "GOOD",
    acquiredAt: "",
    note: "",
    primaryImageUrl: "",
    imageUrls: [""],
  };
}

export function MaterialsAssetsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const accessToken = useAuthStore((state) => state.accessToken);
  const preferencesWorkspaceKey = useAuthStore(
    (state) => state.preferences?.workspaceKey,
  );
  const [items, setItems] = useState<MaterialAsset[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    items_per_page: 10,
    total_items: 0,
    total_pages: 1,
  });

  const [rooms, setRooms] = useState<Room[]>([]);
  const [renters, setRenters] = useState<Renter[]>([]);
  const [assetTypes, setAssetTypes] = useState<MaterialAssetType[]>([]);

  const [mode, setMode] = useState<DeletedMode>("active");
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [roomFilter, setRoomFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [isAssetDialogOpen, setIsAssetDialogOpen] = useState(false);
  const [assetDialogReadonly, setAssetDialogReadonly] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [assetRenterKeyword, setAssetRenterKeyword] = useState("");
  const [form, setForm] = useState<AssetFormState>(() =>
    buildEmptyForm([], []),
  );
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [metadataEntries, setMetadataEntries] = useState<MetadataEntry[]>([
    { key: "", value: "" },
  ]);

  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [managedTypes, setManagedTypes] = useState<MaterialAssetType[]>([]);
  const [typeSearch, setTypeSearch] = useState("");
  const [typeMode, setTypeMode] = useState<DeletedMode>("active");
  const [newTypeName, setNewTypeName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const handledCreateActionRef = useRef<string | null>(null);

  const effectiveAccessToken = accessToken || getAccessToken();
  const effectiveWorkspaceKey =
    (
      preferencesWorkspaceKey ||
      storage.get(ACTIVE_WORKSPACE_STORAGE_KEY) ||
      "personal"
    ).trim() || "personal";

  useEffect(() => {
    void loadLookups();
  }, []);

  useEffect(() => {
    void loadItems();
  }, [mode, searchKeyword, typeFilter, roomFilter, page, pageSize]);

  useEffect(() => {
    if (!isTypeDialogOpen) return;
    void loadManagedTypes();
  }, [isTypeDialogOpen, typeMode, typeSearch]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get("manage") !== "types") return;
    setIsTypeDialogOpen(true);
    query.delete("manage");
    const nextSearch = query.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const roomIdRaw = (query.get("room_id") || "").trim();
    const action = (query.get("action") || "").trim().toLowerCase();
    const parsedRoomId =
      /^\d+$/.test(roomIdRaw) && Number(roomIdRaw) > 0
        ? Number(roomIdRaw)
        : null;

    if (parsedRoomId) {
      setRoomFilter(String(parsedRoomId));
      setPage(1);
    }

    if (action !== "create") {
      handledCreateActionRef.current = null;
      return;
    }

    const actionKey = `${location.pathname}?${location.search}`;
    if (handledCreateActionRef.current === actionKey) {
      return;
    }
    handledCreateActionRef.current = actionKey;
    openCreateAssetDialog(parsedRoomId);

    query.delete("action");
    const nextSearch = query.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  async function loadLookups() {
    try {
      const [roomData, renterData, typeData] = await Promise.all([
        roomsApi.list({
          mode: "active",
          page: 1,
          itemsPerPage: 200,
        }),
        rentersApi.list("active"),
        materialsAssetsApi.listTypes({
          mode: "active",
          page: 1,
          itemsPerPage: 500,
        }),
      ]);
      setRooms(roomData.items);
      setRenters(renterData);
      setAssetTypes(typeData.items);
      setForm((previous) => {
        if (previous.renterId && previous.assetTypeId) {
          return previous;
        }
        const previousRoomId =
          previous.roomId && Number(previous.roomId) > 0
            ? Number(previous.roomId)
            : null;
        return buildEmptyForm(renterData, typeData.items, previousRoomId);
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải dữ liệu tham chiếu."));
    }
  }

  async function loadItems() {
    try {
      const data = await materialsAssetsApi.list({
        mode,
        page,
        itemsPerPage: pageSize,
        searchKey: searchKeyword.trim() || undefined,
        assetTypeId: typeFilter === "ALL" ? undefined : Number(typeFilter),
        roomId: roomFilter === "ALL" ? undefined : Number(roomFilter),
      });
      setItems(data.items);
      setPagination(data.pagination);
      setSelectedIds([]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách tài sản."));
    }
  }

  function handleApplySearch() {
    setPage(1);
    setSearchKeyword(searchInput.trim());
  }

  async function loadManagedTypes() {
    try {
      const data = await materialsAssetsApi.listTypes({
        mode: typeMode,
        page: 1,
        itemsPerPage: 500,
        searchKey: typeSearch.trim() || undefined,
      });
      setManagedTypes(data.items);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể tải danh sách loại tài sản."),
      );
    }
  }

  function updateFormField<K extends keyof AssetFormState>(
    field: K,
    value: AssetFormState[K],
  ) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function handleTypeDialogOpenChange(nextOpen: boolean) {
    setIsTypeDialogOpen(nextOpen);
  }

  function openCreateAssetDialog(initialRoomId?: number | null) {
    setEditingAssetId(null);
    setAssetDialogReadonly(false);
    const fallbackRoomId =
      typeof initialRoomId === "number"
        ? initialRoomId
        : roomFilter !== "ALL"
          ? Number(roomFilter)
          : null;
    setForm(buildEmptyForm(renters, assetTypes, fallbackRoomId));
    setAssetRenterKeyword("");
    setMetadataEntries([{ key: "", value: "" }]);
    setIsAssetDialogOpen(true);
  }

  function openEditAssetDialog(item: MaterialAsset, readonly = false) {
    setEditingAssetId(item.id);
    setAssetDialogReadonly(readonly);
    const mappedImageUrls =
      item.images.length > 0
        ? item.images.map((image) => image.image_url)
        : item.primary_image_url
          ? [item.primary_image_url]
          : [""];
    setForm({
      renterId: String(item.renter_id),
      roomId: item.room_id ? String(item.room_id) : "",
      assetTypeId: String(item.asset_type_id),
      name: item.name,
      quantity: String(item.quantity),
      unit: item.unit ?? "",
      status: item.status,
      conditionStatus: item.condition_status,
      acquiredAt: toDatetimeLocalInput(item.acquired_at),
      note: item.note ?? "",
      primaryImageUrl: item.primary_image_url ?? "",
      imageUrls: mappedImageUrls,
    });
    setAssetRenterKeyword(item.renter_full_name || "");
    setMetadataEntries(parseMetadataEntries(item.metadata_json));
    setIsAssetDialogOpen(true);
  }

  function openImagePicker() {
    if (assetDialogReadonly || uploadingImages) return;
    imageUploadInputRef.current?.click();
  }

  async function handleImageFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploadingImages(true);
    try {
      const uploaded = await Promise.all(
        files.map((file) => materialsAssetsApi.uploadImage(file)),
      );
      const uploadedUrls = uploaded
        .map((item) => {
          const objectName = (item.object_name || "").trim();
          if (objectName) return objectName;
          const fileUrl = (item.file_url || "").trim();
          const marker = "/api/v1/materials-assets/files/";
          if (!fileUrl.includes(marker)) return "";
          return decodeURIComponent(fileUrl.split(marker, 2)[1] || "").trim();
        })
        .filter((objectName) => objectName.length > 0);
      if (uploadedUrls.length === 0) {
        toast.error("Không nhận được object MinIO sau khi upload.");
        return;
      }
      setForm((previous) => {
        const existing = previous.imageUrls
          .map((url) => url.trim())
          .filter((url) => url.length > 0);
        const next = Array.from(new Set([...existing, ...uploadedUrls]));
        return {
          ...previous,
          imageUrls: next.length > 0 ? next : [""],
          primaryImageUrl:
            previous.primaryImageUrl.trim() || uploadedUrls[0] || "",
        };
      });
      toast.success(`Đã upload ${uploadedUrls.length} ảnh lên MinIO.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Upload ảnh MinIO thất bại."));
    } finally {
      setUploadingImages(false);
      if (imageUploadInputRef.current) {
        imageUploadInputRef.current.value = "";
      }
      event.target.value = "";
    }
  }

  function removeUploadedImage(imageUrl: string) {
    setForm((previous) => {
      const next = previous.imageUrls.filter((url) => url !== imageUrl);
      const nextPrimary =
        previous.primaryImageUrl === imageUrl
          ? next[0] || ""
          : previous.primaryImageUrl;
      return {
        ...previous,
        imageUrls: next.length > 0 ? next : [""],
        primaryImageUrl: nextPrimary,
      };
    });
  }

  function setPrimaryImage(imageUrl: string) {
    updateFormField("primaryImageUrl", imageUrl);
  }

  function appendMetadataField() {
    setMetadataEntries((previous) => [...previous, { key: "", value: "" }]);
  }

  function updateMetadataField(
    index: number,
    field: keyof MetadataEntry,
    value: string,
  ) {
    setMetadataEntries((previous) =>
      previous.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, [field]: value } : entry,
      ),
    );
  }

  function removeMetadataField(index: number) {
    setMetadataEntries((previous) => {
      const next = previous.filter((_, currentIndex) => currentIndex !== index);
      return next.length > 0 ? next : [{ key: "", value: "" }];
    });
  }

  async function saveAsset() {
    const renterId = Number(form.renterId);
    const roomId = Number(form.roomId);
    const assetTypeId = Number(form.assetTypeId);
    const quantity = parsePositiveNumber(form.quantity);
    if (!renterId || !assetTypeId || !form.name.trim()) {
      toast.error(
        "Vui lòng chọn khách thuê, loại tài sản và nhập tên tài sản.",
      );
      return;
    }
    if (!quantity) {
      toast.error("Số lượng phải lớn hơn 0.");
      return;
    }

    const normalizedImageUrls = form.imageUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
    const fallbackPrimary =
      form.primaryImageUrl.trim() || normalizedImageUrls[0] || null;

    const payload = {
      room_id:
        Number.isFinite(roomId) && roomId > 0 ? Math.trunc(roomId) : undefined,
      renter_id: renterId,
      asset_type_id: assetTypeId,
      name: form.name.trim(),
      quantity,
      unit: form.unit.trim() || null,
      status: form.status.trim() || "ACTIVE",
      condition_status: form.conditionStatus.trim() || "GOOD",
      acquired_at: toIsoDatetime(form.acquiredAt),
      metadata_json: buildMetadataJson(metadataEntries),
      note: form.note.trim() || null,
      primary_image_url: fallbackPrimary,
      image_urls: normalizedImageUrls,
    };

    try {
      if (editingAssetId) {
        await materialsAssetsApi.update(editingAssetId, payload);
        toast.success("Cập nhật tài sản thành công.");
      } else {
        await materialsAssetsApi.create(payload);
        toast.success("Thêm tài sản thành công.");
      }
      setIsAssetDialogOpen(false);
      await Promise.all([loadItems(), loadLookups()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu tài sản thất bại."));
    }
  }

  async function removeAsset(assetId: number) {
    try {
      await materialsAssetsApi.remove(assetId);
      toast.success("Xóa mềm tài sản thành công.");
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xóa tài sản."));
    }
  }

  async function bulkDeleteAssets() {
    if (!selectedIds.length) return;
    try {
      if (mode === "trash") {
        await Promise.all(
          selectedIds.map((itemId) => materialsAssetsApi.removeHard(itemId)),
        );
        toast.success("Xóa vĩnh viễn tài sản thành công.");
      } else {
        await Promise.all(
          selectedIds.map((itemId) => materialsAssetsApi.remove(itemId)),
        );
        toast.success("Xóa mềm tài sản thành công.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xóa tài sản đã chọn."));
    }
  }

  async function createAssetType() {
    const name = newTypeName.trim();
    if (!name) {
      toast.error("Vui lòng nhập tên loại tài sản.");
      return;
    }
    try {
      await materialsAssetsApi.createType({ name });
      setNewTypeName("");
      await Promise.all([loadManagedTypes(), loadLookups()]);
      toast.success("Đã tạo loại tài sản.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tạo loại tài sản."));
    }
  }

  function startEditType(item: MaterialAssetType) {
    setEditingTypeId(item.id);
    setEditingTypeName(item.name);
  }

  function cancelEditType() {
    setEditingTypeId(null);
    setEditingTypeName("");
  }

  async function saveTypeEdit() {
    if (!editingTypeId) return;
    const name = editingTypeName.trim();
    if (!name) {
      toast.error("Tên loại tài sản không được để trống.");
      return;
    }
    try {
      await materialsAssetsApi.updateType(editingTypeId, { name });
      cancelEditType();
      await Promise.all([loadManagedTypes(), loadLookups()]);
      toast.success("Đã cập nhật loại tài sản.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể cập nhật loại tài sản."));
    }
  }

  async function removeType(item: MaterialAssetType) {
    try {
      if (item.deleted_at) {
        await materialsAssetsApi.removeTypeHard(item.id);
        toast.success("Đã xóa vĩnh viễn loại tài sản.");
      } else {
        await materialsAssetsApi.removeType(item.id);
        toast.success("Đã xóa mềm loại tài sản.");
      }
      await Promise.all([loadManagedTypes(), loadLookups()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xóa loại tài sản."));
    }
  }

  const allOnPageSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));
  const filteredDialogRenters = useMemo(() => {
    const keyword = assetRenterKeyword.trim().toLowerCase();
    if (!keyword) return renters.slice(0, 12);
    return renters
      .filter((item) =>
        [item.full_name, item.phone, item.email || "", item.id_number || ""]
          .join(" ")
          .toLowerCase()
          .includes(keyword),
      )
      .slice(0, 20);
  }, [assetRenterKeyword, renters]);
  const selectedDialogRenter = useMemo(
    () => renters.find((item) => String(item.id) === form.renterId) ?? null,
    [form.renterId, renters],
  );
  const selectedDialogRoom = useMemo(
    () => rooms.find((item) => String(item.id) === form.roomId) ?? null,
    [form.roomId, rooms],
  );

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Quản lý tài sản và vật tư khách thuê
      </h1>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Bộ lọc và thao tác</CardTitle>
          <div className="grid gap-3 lg:grid-cols-8">
            <Input
              className="lg:col-span-2"
              placeholder="Tìm theo tên tài sản, phòng..."
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleApplySearch();
                }
              }}
            />
            <Button type="button" onClick={handleApplySearch}>
              Tìm kiếm
            </Button>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Loại tài sản: Tất cả</option>
              {assetTypes.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={roomFilter}
              onChange={(event) => {
                setRoomFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">Phòng: Tất cả</option>
              {rooms.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.code}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as DeletedMode);
                setPage(1);
              }}
            >
              <option value="active">Đang hoạt động</option>
              <option value="trash">Thùng rác</option>
              <option value="all">Tất cả</option>
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={String(pageSize)}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value="10">10 / trang</option>
              <option value="20">20 / trang</option>
              <option value="50">50 / trang</option>
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTypeDialogOpen(true)}
            >
              Quản lý loại
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => openCreateAssetDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm tài sản
            </Button>
            <Button
              type="button"
              variant={mode === "trash" ? "destructive" : "outline"}
              disabled={!selectedIds.length}
              onClick={() => void bulkDeleteAssets()}
            >
              {mode === "trash" ? "Xóa vĩnh viễn đã chọn" : "Xóa đã chọn"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách tài sản vật tư</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setSelectedIds((previous) =>
                          Array.from(
                            new Set([
                              ...previous,
                              ...items.map((item) => item.id),
                            ]),
                          ),
                        );
                        return;
                      }
                      setSelectedIds((previous) =>
                        previous.filter(
                          (id) => !items.some((item) => item.id === id),
                        ),
                      );
                    }}
                  />
                </th>
                <th className="px-2 py-2">Tên tài sản</th>
                <th className="px-2 py-2">Loại</th>
                <th className="px-2 py-2">Phòng</th>
                <th className="px-2 py-2">Khách thuê</th>
                <th className="px-2 py-2">Số lượng</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Ảnh</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() => openEditAssetDialog(item, mode !== "active")}
                >
                  <td
                    className="px-2 py-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedIds((previous) => [...previous, item.id]);
                          return;
                        }
                        setSelectedIds((previous) =>
                          previous.filter((id) => id !== item.id),
                        );
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground">
                      #{item.id}
                    </div>
                  </td>
                  <td className="px-2 py-2">{item.asset_type_name || "-"}</td>
                  <td className="px-2 py-2">{item.room_code || "-"}</td>
                  <td className="px-2 py-2">{item.renter_full_name || "-"}</td>
                  <td className="px-2 py-2">
                    {item.quantity}
                    {item.unit ? ` ${item.unit}` : ""}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          getAssetStatusBadgeClass(item.status),
                        )}
                      >
                        {getAssetStatusLabel(item.status)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                          getConditionStatusBadgeClass(item.condition_status),
                        )}
                      >
                        {getConditionStatusLabel(item.condition_status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    {item.images.length || (item.primary_image_url ? 1 : 0)}
                  </td>
                  <td
                    className="px-2 py-2 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          openEditAssetDialog(item, mode !== "active")
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        disabled={mode !== "active"}
                        onClick={() => void removeAsset(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-2 py-8 text-center text-muted-foreground"
                  >
                    Không có dữ liệu tài sản vật tư.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Trang {pagination.page}/{Math.max(1, pagination.total_pages)} -
              Tổng {pagination.total_items} bản ghi
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.max(1, pagination.total_pages)}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAssetDialogOpen} onOpenChange={setIsAssetDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssetId
                ? "Chi tiết tài sản vật tư"
                : "Thêm tài sản vật tư"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2 md:col-span-3">
              <label className="text-sm font-medium">
                Tìm khách thuê (tên, SĐT, email, CCCD)
              </label>
              <Input
                placeholder="Nhập để tìm khách thuê..."
                value={assetRenterKeyword}
                onChange={(event) => setAssetRenterKeyword(event.target.value)}
                disabled={assetDialogReadonly}
              />
              <div className="max-h-56 overflow-auto rounded-md border">
                {filteredDialogRenters.map((renter) => (
                  <button
                    key={renter.id}
                    type="button"
                    className={`flex w-full items-start justify-between border-b px-3 py-2 text-left text-sm hover:bg-muted/40 ${
                      form.renterId === String(renter.id) ? "bg-primary/10" : ""
                    }`}
                    onClick={() => {
                      if (assetDialogReadonly) return;
                      updateFormField("renterId", String(renter.id));
                      setAssetRenterKeyword(renter.full_name);
                    }}
                    disabled={assetDialogReadonly}
                  >
                    <span>
                      <strong>{renter.full_name}</strong>
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {renter.phone}
                        {renter.email ? ` • ${renter.email}` : ""}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      #{renter.id}
                    </span>
                  </button>
                ))}
                {filteredDialogRenters.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-muted-foreground">
                    Không có khách thuê phù hợp.
                  </div>
                ) : null}
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="mb-1 font-medium">Khách thuê đã chọn</p>
                {selectedDialogRenter ? (
                  <div className="grid gap-1 md:grid-cols-2">
                    <p>
                      Họ tên: <strong>{selectedDialogRenter.full_name}</strong>
                    </p>
                    <p>
                      SĐT: <strong>{selectedDialogRenter.phone || "-"}</strong>
                    </p>
                    <p>
                      Email:{" "}
                      <strong>{selectedDialogRenter.email || "-"}</strong>
                    </p>
                    <p>
                      CCCD/CMND:{" "}
                      <strong>{selectedDialogRenter.id_number || "-"}</strong>
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Chưa chọn khách thuê cho tài sản này.
                  </p>
                )}
              </div>
              {form.roomId ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <p className="mb-1 font-medium">Phòng gắn tài sản</p>
                  <p>
                    {selectedDialogRoom
                      ? `${selectedDialogRoom.code} (ID #${selectedDialogRoom.id})`
                      : `Phòng ID #${form.roomId}`}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Tên tài sản</label>
              <Input
                value={form.name}
                onChange={(event) =>
                  updateFormField("name", event.target.value)
                }
                disabled={assetDialogReadonly}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Loại tài sản</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={form.assetTypeId}
                onChange={(event) =>
                  updateFormField("assetTypeId", event.target.value)
                }
                disabled={assetDialogReadonly}
              >
                <option value="">Chọn loại tài sản</option>
                {assetTypes.map((assetType) => (
                  <option key={assetType.id} value={String(assetType.id)}>
                    {assetType.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Số lượng</label>
              <Input
                type="number"
                min={0}
                value={form.quantity}
                onChange={(event) =>
                  updateFormField("quantity", event.target.value)
                }
                disabled={assetDialogReadonly}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Đơn vị</label>
              <Input
                value={form.unit}
                placeholder="cái, chiếc, bộ..."
                onChange={(event) =>
                  updateFormField("unit", event.target.value)
                }
                disabled={assetDialogReadonly}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Trạng thái</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={form.status}
                onChange={(event) =>
                  updateFormField("status", event.target.value)
                }
                disabled={assetDialogReadonly}
              >
                {MATERIAL_ASSET_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Tình trạng</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={form.conditionStatus}
                onChange={(event) =>
                  updateFormField("conditionStatus", event.target.value)
                }
                disabled={assetDialogReadonly}
              >
                {MATERIAL_ASSET_CONDITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Ngày tiếp nhận</label>
              <Input
                type="datetime-local"
                value={form.acquiredAt}
                onChange={(event) =>
                  updateFormField("acquiredAt", event.target.value)
                }
                disabled={assetDialogReadonly}
              />
            </div>

            <div className="space-y-2 md:col-span-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Ảnh tài sản (upload MinIO)
                </label>
                <input
                  ref={imageUploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageFilesChange}
                />
                {!assetDialogReadonly ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={openImagePicker}
                    disabled={uploadingImages}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    {uploadingImages ? "Đang upload..." : "Upload ảnh"}
                  </Button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {form.imageUrls
                  .map((url) => url.trim())
                  .filter((url) => url.length > 0)
                  .map((url) => {
                    const resolvedUrl = resolveAssetImageUrl(
                      url,
                      effectiveAccessToken,
                      effectiveWorkspaceKey,
                    );
                    const isPrimary = form.primaryImageUrl === url;
                    return (
                      <div
                        key={url}
                        className="space-y-2 rounded-md border bg-muted/20 p-2"
                      >
                        <img
                          src={resolvedUrl}
                          alt="Ảnh tài sản"
                          className="h-28 w-full rounded object-cover"
                          loading="lazy"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={isPrimary ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setPrimaryImage(url)}
                            disabled={assetDialogReadonly}
                          >
                            {isPrimary ? "Ảnh chính" : "Đặt ảnh chính"}
                          </Button>
                          {!assetDialogReadonly ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={() => removeUploadedImage(url)}
                              aria-label="Xóa ảnh"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
              </div>
              {form.imageUrls
                .map((url) => url.trim())
                .filter((url) => url.length > 0).length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Chưa có ảnh. Nhấn Upload ảnh để tải lên MinIO.
                </p>
              ) : null}
              <div className="rounded-md border border-dashed border-border/70 bg-background/60 p-2">
                <p className="text-xs text-muted-foreground">
                  Ảnh được lưu trên MinIO. Bạn có thể chọn 1 ảnh làm ảnh chính.
                </p>
              </div>
            </div>

            <div className="space-y-2 md:col-span-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Thuộc tính mở rộng (linh hoạt theo từng loại tài sản)
                </label>
                {!assetDialogReadonly ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={appendMetadataField}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Thêm thuộc tính
                  </Button>
                ) : null}
              </div>
              <div className="space-y-2">
                {metadataEntries.map((entry, index) => (
                  <div
                    key={`metadata-${index}`}
                    className="grid gap-2 md:grid-cols-[1fr_2fr_auto]"
                  >
                    <Input
                      value={entry.key}
                      placeholder="Tên thuộc tính (vd: số khung, màu nội thất)"
                      onChange={(event) =>
                        updateMetadataField(index, "key", event.target.value)
                      }
                      disabled={assetDialogReadonly}
                    />
                    <Input
                      value={entry.value}
                      placeholder="Giá trị"
                      onChange={(event) =>
                        updateMetadataField(index, "value", event.target.value)
                      }
                      disabled={assetDialogReadonly}
                    />
                    {!assetDialogReadonly ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => removeMetadataField(index)}
                        aria-label="Xóa thuộc tính"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Dữ liệu thuộc tính sẽ được lưu vào `metadata_json` để bạn tùy
                biến cho mọi loại tài sản/vật tư theo nhu cầu thực tế.
              </p>
            </div>
            <div className="space-y-1 md:col-span-3">
              <label className="text-sm font-medium">Ghi chú</label>
              <textarea
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.note}
                onChange={(event) =>
                  updateFormField("note", event.target.value)
                }
                disabled={assetDialogReadonly}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAssetDialogOpen(false)}
            >
              Đóng
            </Button>
            {!assetDialogReadonly ? (
              <Button type="button" onClick={() => void saveAsset()}>
                Lưu
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTypeDialogOpen} onOpenChange={handleTypeDialogOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quản lý loại tài sản vật tư</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-3">
            <Input
              className="md:col-span-2"
              placeholder="Tìm loại tài sản..."
              value={typeSearch}
              onChange={(event) => setTypeSearch(event.target.value)}
            />
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={typeMode}
              onChange={(event) =>
                setTypeMode(event.target.value as DeletedMode)
              }
            >
              <option value="active">Đang hoạt động</option>
              <option value="trash">Thùng rác</option>
              <option value="all">Tất cả</option>
            </select>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Tên loại tài sản mới"
              value={newTypeName}
              onChange={(event) => setNewTypeName(event.target.value)}
            />
            <Button type="button" onClick={() => void createAssetType()}>
              Thêm loại
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2">Tên loại</th>
                  <th className="px-2 py-2">Trạng thái</th>
                  <th className="px-2 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {managedTypes.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-2 py-2">
                      {editingTypeId === item.id ? (
                        <Input
                          value={editingTypeName}
                          onChange={(event) =>
                            setEditingTypeName(event.target.value)
                          }
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {item.deleted_at ? "Đã xóa mềm" : "Đang hoạt động"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {editingTypeId === item.id ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void saveTypeEdit()}
                            >
                              Lưu
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={cancelEditType}
                            >
                              Hủy
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => startEditType(item)}
                              disabled={Boolean(item.deleted_at)}
                            >
                              Sửa
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={
                                item.deleted_at ? "destructive" : "outline"
                              }
                              onClick={() => void removeType(item)}
                            >
                              {item.deleted_at ? "Xóa vĩnh viễn" : "Xóa"}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {managedTypes.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-6 text-center text-muted-foreground"
                    >
                      Không có loại tài sản phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleTypeDialogOpenChange(false)}
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
