import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ArrowLeft, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
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
import { areasApi } from "@/features/areas/api/areas.api";
import { branchesApi } from "@/features/branches/api/branches.api";
import { buildingsApi } from "@/features/buildings/api/buildings.api";
import {
  materialsAssetsApi,
  type MaterialAsset,
  type MaterialAssetType,
} from "@/features/materials-assets/api/materials-assets.api";
import type {
  Area,
  Branch,
  Building,
  Room,
  RoomType,
} from "@/features/ops/types";
import { roomTypesApi } from "@/features/room-types/api/room-types.api";
import { roomsApi } from "@/features/rooms/api/rooms.api";
import { getAccessToken } from "@/services/auth/token";
import { storage } from "@/services/storage";
import { useAuthStore } from "@/store/auth.store";

type ApiErrorBody = { message?: string };
type MetadataRecord = Record<string, unknown>;
type MetadataEntry = { key: string; value: string };
type RoomAssetFormState = {
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

const ACTIVE_WORKSPACE_STORAGE_KEY = "active_workspace_key";
const MAX_LOOP_PAGES = 20;
const ROOM_ASSET_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ACTIVE", label: "Đang sử dụng" },
  { value: "INACTIVE", label: "Ngừng sử dụng" },
  { value: "LOST", label: "Thất lạc" },
  { value: "DISPOSED", label: "Thanh lý" },
];
const ROOM_ASSET_CONDITION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "NEW", label: "Mới" },
  { value: "GOOD", label: "Tốt" },
  { value: "FAIR", label: "Trung bình" },
  { value: "DAMAGED", label: "Hư hỏng" },
];

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function getRoomStatusLabel(status: Room["current_status"]): string {
  if (status === "VACANT") return "Trống";
  if (status === "DEPOSITED") return "Đã đặt cọc";
  if (status === "RENTED") return "Đã thuê";
  if (status === "MAINTENANCE") return "Đang sửa chữa";
  return status;
}

function getAssetStatusLabel(status: string): string {
  if (status === "ACTIVE") return "Đang sử dụng";
  if (status === "INACTIVE") return "Ngừng sử dụng";
  if (status === "LOST") return "Thất lạc";
  if (status === "DISPOSED") return "Thanh lý";
  return status;
}

function getConditionStatusLabel(status: string): string {
  if (status === "NEW") return "Mới";
  if (status === "GOOD") return "Tốt";
  if (status === "FAIR") return "Trung bình";
  if (status === "DAMAGED") return "Hư hỏng";
  return status;
}

function formatDatetime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function resolveAssetImageUrl(
  rawUrl: string,
  accessToken: string | null,
  workspaceKey: string,
): string {
  const normalized = rawUrl.trim();
  if (!normalized) return normalized;

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "");
  const toAbsolute = (relativePath: string) =>
    new URL(relativePath, apiBaseUrl || window.location.origin).toString();
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

function parseMetadataRows(
  metadataJson: string | null,
): Array<[string, string]> {
  if (!metadataJson) return [];
  try {
    const parsed = JSON.parse(metadataJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return [];
    return Object.entries(parsed as MetadataRecord).map(([key, value]) => [
      key,
      value === null || value === undefined
        ? ""
        : typeof value === "string"
          ? value
          : JSON.stringify(value),
    ]);
  } catch {
    return [];
  }
}

function parseMetadataEntries(
  metadataJson: string | null | undefined,
): MetadataEntry[] {
  const rows = parseMetadataRows(metadataJson || null);
  if (rows.length === 0) return [{ key: "", value: "" }];
  return rows.map(([key, value]) => ({ key, value }));
}

function buildMetadataJson(entries: MetadataEntry[]): string | null {
  const normalized = entries
    .map((entry) => ({ key: entry.key.trim(), value: entry.value.trim() }))
    .filter((entry) => entry.key.length > 0);
  if (normalized.length === 0) return null;
  const payload: Record<string, string> = {};
  normalized.forEach((entry) => {
    payload[entry.key] = entry.value;
  });
  return JSON.stringify(payload);
}

function parsePositiveNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function toIsoDatetime(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toDatetimeLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function buildEmptyRoomAssetForm(
  assetTypes: MaterialAssetType[],
): RoomAssetFormState {
  return {
    assetTypeId: assetTypes[0] ? String(assetTypes[0].id) : "",
    name: "",
    quantity: "1",
    unit: "",
    status: "ACTIVE",
    conditionStatus: "GOOD",
    acquiredAt: "",
    note: "",
    primaryImageUrl: "",
    imageUrls: [],
  };
}

export function RoomAssetsDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId, assetId } = useParams<{
    roomId?: string;
    assetId?: string;
  }>();
  const accessToken = useAuthStore((state) => state.accessToken);
  const preferencesWorkspaceKey = useAuthStore(
    (state) => state.preferences?.workspaceKey,
  );

  const roomIdNumber = useMemo(() => {
    const normalized = (roomId || "").trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [roomId]);
  const assetIdNumber = useMemo(() => {
    const normalized = (assetId || "").trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [assetId]);

  const [loading, setLoading] = useState(false);
  const [allAssets, setAllAssets] = useState<MaterialAsset[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [assetTypes, setAssetTypes] = useState<MaterialAssetType[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAsset, setDetailAsset] = useState<MaterialAsset | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creatingAsset, setCreatingAsset] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [createForm, setCreateForm] = useState<RoomAssetFormState>(() =>
    buildEmptyRoomAssetForm([]),
  );
  const [createMetadataEntries, setCreateMetadataEntries] = useState<
    MetadataEntry[]
  >([{ key: "", value: "" }]);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const handledActionRef = useRef<string | null>(null);
  const handledEditPathRef = useRef<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);

  const effectiveAccessToken = accessToken || getAccessToken();
  const effectiveWorkspaceKey =
    (
      preferencesWorkspaceKey ||
      storage.get(ACTIVE_WORKSPACE_STORAGE_KEY) ||
      "personal"
    ).trim() || "personal";

  useEffect(() => {
    if (!roomIdNumber) return;
    void loadData(roomIdNumber);
  }, [roomIdNumber]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const action = (query.get("action") || "").trim().toLowerCase();
    if (action !== "create") {
      handledActionRef.current = null;
      return;
    }

    const actionKey = `${location.pathname}?${location.search}`;
    if (handledActionRef.current === actionKey) return;
    handledActionRef.current = actionKey;
    openCreateDialog();

    query.delete("action");
    const nextSearch = query.toString();
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate, assetTypes]);

  useEffect(() => {
    if (!roomIdNumber || !assetIdNumber) {
      handledEditPathRef.current = null;
      return;
    }
    const editKey = `${roomIdNumber}:${assetIdNumber}`;
    if (handledEditPathRef.current === editKey) return;

    const found = allAssets.find((item) => item.id === assetIdNumber);
    if (!found) {
      if (!loading) {
        handledEditPathRef.current = editKey;
        toast.error("Không tìm thấy tài sản phòng để chỉnh sửa.");
        navigate(`/dashboard/room-assets/${roomIdNumber}`, { replace: true });
      }
      return;
    }

    handledEditPathRef.current = editKey;
    openEditDialog(found);
  }, [assetIdNumber, allAssets, loading, navigate, roomIdNumber]);

  async function loadAllRooms(): Promise<Room[]> {
    const all: Room[] = [];
    let currentPage = 1;
    let totalPages = 1;
    while (currentPage <= totalPages && currentPage <= MAX_LOOP_PAGES) {
      const response = await roomsApi.list({
        mode: "active",
        page: currentPage,
        itemsPerPage: 200,
      });
      all.push(...response.items);
      totalPages = Math.max(1, response.pagination.total_pages);
      currentPage += 1;
    }
    return all;
  }

  async function loadAllAreas(): Promise<Area[]> {
    const all: Area[] = [];
    let currentPage = 1;
    let totalPages = 1;
    while (currentPage <= totalPages && currentPage <= MAX_LOOP_PAGES) {
      const response = await areasApi.list({
        mode: "active",
        page: currentPage,
        itemsPerPage: 200,
      });
      all.push(...response.items);
      totalPages = Math.max(1, response.pagination.total_pages);
      currentPage += 1;
    }
    return all;
  }

  async function loadRoomAssets(roomIdValue: number): Promise<MaterialAsset[]> {
    const all: MaterialAsset[] = [];
    let currentPage = 1;
    let totalPages = 1;
    while (currentPage <= totalPages && currentPage <= MAX_LOOP_PAGES) {
      const response = await materialsAssetsApi.list({
        mode: "active",
        page: currentPage,
        itemsPerPage: 200,
        roomId: roomIdValue,
        ownerScope: "ROOM",
      });
      all.push(
        ...response.items.filter((item) => item.room_id === roomIdValue),
      );
      totalPages = Math.max(1, response.pagination.total_pages);
      currentPage += 1;
    }
    return all;
  }

  async function loadData(roomIdValue: number) {
    setLoading(true);
    try {
      const [
        roomData,
        areaData,
        branchData,
        buildingData,
        roomTypeData,
        assets,
        assetTypeData,
      ] = await Promise.all([
        loadAllRooms(),
        loadAllAreas(),
        branchesApi.list("active"),
        buildingsApi.list("active"),
        roomTypesApi.list("active"),
        loadRoomAssets(roomIdValue),
        materialsAssetsApi.listTypes({
          mode: "active",
          page: 1,
          itemsPerPage: 500,
        }),
      ]);
      setRooms(roomData);
      setAreas(areaData);
      setBranches(branchData);
      setBuildings(buildingData);
      setRoomTypes(roomTypeData);
      setAllAssets(assets);
      setAssetTypes(assetTypeData.items);
      setCreateForm((previous) => {
        if (previous.assetTypeId) return previous;
        return buildEmptyRoomAssetForm(assetTypeData.items);
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải tài sản phòng."));
    } finally {
      setLoading(false);
    }
  }

  const roomMap = useMemo(
    () => new Map(rooms.map((item) => [item.id, item])),
    [rooms],
  );
  const branchMap = useMemo(
    () => new Map(branches.map((item) => [item.id, item.name])),
    [branches],
  );
  const areaMap = useMemo(
    () => new Map(areas.map((item) => [item.id, item.name])),
    [areas],
  );
  const buildingMap = useMemo(
    () => new Map(buildings.map((item) => [item.id, item.name])),
    [buildings],
  );
  const roomTypeMap = useMemo(
    () => new Map(roomTypes.map((item) => [item.id, item.name])),
    [roomTypes],
  );

  const currentRoom = roomIdNumber ? roomMap.get(roomIdNumber) || null : null;

  const filteredAssets = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    if (!normalizedQuery) return allAssets;
    return allAssets.filter((item) => {
      const searchable = [
        item.name,
        item.asset_type_name || "",
        item.note || "",
        item.identifier || "",
        item.room_code || "",
      ]
        .join(" ")
        .toLowerCase();
      return normalizedQuery
        .split(/\s+/)
        .every((token) => searchable.includes(token));
    });
  }, [allAssets, search]);

  const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const pagedAssets = useMemo(() => {
    const normalizedPage = Math.min(page, totalPages);
    const start = (normalizedPage - 1) * pageSize;
    return filteredAssets.slice(start, start + pageSize);
  }, [filteredAssets, page, pageSize, totalPages]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function openAssetDetail(asset: MaterialAsset) {
    setDetailAsset(asset);
    setDetailOpen(true);
  }

  function navigateEditAsset(assetId: number) {
    if (!roomIdNumber) return;
    navigate(
      `/dashboard/room-assets/${roomIdNumber}/assets/${assetId}/edit?owner_scope=ROOM`,
    );
  }

  async function removeAsset(asset: MaterialAsset) {
    const accepted = window.confirm(
      `Bạn có chắc muốn xóa tài sản "${asset.name}" khỏi danh sách không?`,
    );
    if (!accepted) return;
    setDeletingAssetId(asset.id);
    try {
      await materialsAssetsApi.remove(asset.id);
      setAllAssets((previous) =>
        previous.filter((item) => item.id !== asset.id),
      );
      if (detailAsset?.id === asset.id) {
        setDetailAsset(null);
        setDetailOpen(false);
      }
      toast.success("Đã xóa tài sản thành công.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xóa tài sản."));
    } finally {
      setDeletingAssetId(null);
    }
  }

  function openCreateDialog() {
    setEditingAssetId(null);
    setCreateForm(buildEmptyRoomAssetForm(assetTypes));
    setCreateMetadataEntries(parseMetadataEntries(null));
    setIsCreateDialogOpen(true);
  }

  function openEditDialog(asset: MaterialAsset) {
    const mappedImageUrls =
      asset.images.length > 0
        ? asset.images.map((image) => image.image_url)
        : asset.primary_image_url
          ? [asset.primary_image_url]
          : [];

    setEditingAssetId(asset.id);
    setCreateForm({
      assetTypeId: String(asset.asset_type_id),
      name: asset.name,
      quantity: String(asset.quantity),
      unit: asset.unit || "",
      status: asset.status,
      conditionStatus: asset.condition_status,
      acquiredAt: toDatetimeLocalInput(asset.acquired_at),
      note: asset.note || "",
      primaryImageUrl: asset.primary_image_url || mappedImageUrls[0] || "",
      imageUrls: mappedImageUrls,
    });
    setCreateMetadataEntries(parseMetadataEntries(asset.metadata_json));
    setIsCreateDialogOpen(true);
  }

  function closeAssetDialog() {
    setIsCreateDialogOpen(false);
    if (roomIdNumber && assetIdNumber) {
      navigate(`/dashboard/room-assets/${roomIdNumber}`, { replace: true });
    }
  }

  function handleAssetDialogOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setIsCreateDialogOpen(true);
      return;
    }
    closeAssetDialog();
  }

  function updateCreateFormField<K extends keyof RoomAssetFormState>(
    field: K,
    value: RoomAssetFormState[K],
  ) {
    setCreateForm((previous) => ({ ...previous, [field]: value }));
  }

  function appendMetadataField() {
    setCreateMetadataEntries((previous) => [
      ...previous,
      { key: "", value: "" },
    ]);
  }

  function updateMetadataField(
    index: number,
    field: keyof MetadataEntry,
    value: string,
  ) {
    setCreateMetadataEntries((previous) =>
      previous.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, [field]: value } : entry,
      ),
    );
  }

  function removeMetadataField(index: number) {
    setCreateMetadataEntries((previous) => {
      const next = previous.filter((_, currentIndex) => currentIndex !== index);
      return next.length > 0 ? next : [{ key: "", value: "" }];
    });
  }

  function openImagePicker() {
    if (uploadingImages || creatingAsset) return;
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
        .map((item) => (item.object_name || "").trim())
        .filter((item) => item.length > 0);
      if (uploadedUrls.length === 0) {
        toast.error("Không nhận được object MinIO sau khi upload.");
        return;
      }
      setCreateForm((previous) => {
        const existing = previous.imageUrls
          .map((url) => url.trim())
          .filter(Boolean);
        const next = Array.from(new Set([...existing, ...uploadedUrls]));
        return {
          ...previous,
          imageUrls: next,
          primaryImageUrl:
            previous.primaryImageUrl.trim() || uploadedUrls[0] || "",
        };
      });
      toast.success(`Đã upload ${uploadedUrls.length} ảnh.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Upload ảnh thất bại."));
    } finally {
      setUploadingImages(false);
      if (imageUploadInputRef.current) imageUploadInputRef.current.value = "";
      event.target.value = "";
    }
  }

  function removeUploadedImage(imageUrl: string) {
    setCreateForm((previous) => {
      const next = previous.imageUrls.filter((url) => url !== imageUrl);
      return {
        ...previous,
        imageUrls: next,
        primaryImageUrl:
          previous.primaryImageUrl === imageUrl
            ? next[0] || ""
            : previous.primaryImageUrl,
      };
    });
  }

  function setPrimaryImage(imageUrl: string) {
    updateCreateFormField("primaryImageUrl", imageUrl);
  }

  async function saveRoomAsset() {
    if (!roomIdNumber) return;
    const assetTypeId = Number(createForm.assetTypeId);
    const quantity = parsePositiveNumber(createForm.quantity);
    if (!assetTypeId || !createForm.name.trim()) {
      toast.error("Vui lòng nhập tên tài sản và chọn loại tài sản.");
      return;
    }
    if (!quantity) {
      toast.error("Số lượng phải lớn hơn 0.");
      return;
    }

    const normalizedImageUrls = createForm.imageUrls
      .map((url) => url.trim())
      .filter((url) => url.length > 0);
    const fallbackPrimary =
      createForm.primaryImageUrl.trim() || normalizedImageUrls[0] || null;

    setCreatingAsset(true);
    try {
      if (editingAssetId) {
        const updated = await materialsAssetsApi.update(editingAssetId, {
          room_id: roomIdNumber,
          owner_scope: "ROOM",
          asset_type_id: assetTypeId,
          name: createForm.name.trim(),
          quantity,
          unit: createForm.unit.trim() || null,
          status: createForm.status.trim() || "ACTIVE",
          condition_status: createForm.conditionStatus.trim() || "GOOD",
          acquired_at: toIsoDatetime(createForm.acquiredAt),
          metadata_json: buildMetadataJson(createMetadataEntries),
          note: createForm.note.trim() || null,
          primary_image_url: fallbackPrimary,
          image_urls: normalizedImageUrls,
        });
        setAllAssets((previous) =>
          previous.map((item) => (item.id === updated.id ? updated : item)),
        );
        setDetailAsset((previous) =>
          previous && previous.id === updated.id ? updated : previous,
        );
        toast.success("Đã cập nhật tài sản phòng.");
      } else {
        const created = await materialsAssetsApi.create({
          room_id: roomIdNumber,
          owner_scope: "ROOM",
          asset_type_id: assetTypeId,
          name: createForm.name.trim(),
          quantity,
          unit: createForm.unit.trim() || null,
          status: createForm.status.trim() || "ACTIVE",
          condition_status: createForm.conditionStatus.trim() || "GOOD",
          acquired_at: toIsoDatetime(createForm.acquiredAt),
          metadata_json: buildMetadataJson(createMetadataEntries),
          note: createForm.note.trim() || null,
          primary_image_url: fallbackPrimary,
          image_urls: normalizedImageUrls,
        });
        setAllAssets((previous) => [created, ...previous]);
        toast.success("Đã thêm tài sản phòng.");
      }
      closeAssetDialog();
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          editingAssetId
            ? "Không thể cập nhật tài sản phòng."
            : "Không thể thêm tài sản phòng.",
        ),
      );
    } finally {
      setCreatingAsset(false);
    }
  }

  if (!roomIdNumber) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Chi tiết tài sản phòng</h1>
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Mã phòng không hợp lệ.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Chi tiết tài sản phòng</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/dashboard/room-assets")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Danh sách phòng
          </Button>
          <Button type="button" onClick={openCreateDialog}>
            <Plus className="mr-1 h-4 w-4" />
            Thêm tài sản phòng
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin phòng</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-3">
          <p>
            Mã phòng:{" "}
            <strong>
              {currentRoom ? currentRoom.code : `#${roomIdNumber}`}
            </strong>
          </p>
          <p>
            Chi nhánh:{" "}
            <strong>
              {currentRoom
                ? branchMap.get(currentRoom.branch_id) ||
                  `#${currentRoom.branch_id}`
                : "-"}
            </strong>
          </p>
          <p>
            Khu vực:{" "}
            <strong>
              {currentRoom
                ? areaMap.get(currentRoom.area_id) || `#${currentRoom.area_id}`
                : "-"}
            </strong>
          </p>
          <p>
            Tòa nhà:{" "}
            <strong>
              {currentRoom
                ? buildingMap.get(currentRoom.building_id) ||
                  `#${currentRoom.building_id}`
                : "-"}
            </strong>
          </p>
          <p>
            Loại phòng:{" "}
            <strong>
              {currentRoom
                ? roomTypeMap.get(currentRoom.room_type_id) ||
                  `#${currentRoom.room_type_id}`
                : "-"}
            </strong>
          </p>
          <p>
            Trạng thái:{" "}
            <strong>
              {currentRoom
                ? getRoomStatusLabel(currentRoom.current_status)
                : "-"}
            </strong>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách tài sản trong phòng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              className="md:col-span-2"
              placeholder="Tìm theo tên tài sản, loại, ghi chú..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
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
          </div>

          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2">Tên tài sản</th>
                  <th className="px-2 py-2">Loại tài sản</th>
                  <th className="px-2 py-2">Số lượng</th>
                  <th className="px-2 py-2">Trạng thái</th>
                  <th className="px-2 py-2">Tình trạng</th>
                  <th className="px-2 py-2">Cập nhật</th>
                  <th className="px-2 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pagedAssets.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-2 py-2 font-medium">{item.name}</td>
                    <td className="px-2 py-2">{item.asset_type_name || "-"}</td>
                    <td className="px-2 py-2">
                      {item.quantity}
                      {item.unit ? ` ${item.unit}` : ""}
                    </td>
                    <td className="px-2 py-2">
                      {getAssetStatusLabel(item.status)}
                    </td>
                    <td className="px-2 py-2">
                      {getConditionStatusLabel(item.condition_status)}
                    </td>
                    <td className="px-2 py-2">
                      {formatDatetime(item.updated_at)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => openAssetDetail(item)}
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => navigateEditAsset(item.id)}
                          title="Chỉnh sửa"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={deletingAssetId === item.id}
                          onClick={() => void removeAsset(item)}
                          title="Xóa tài sản"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && pagedAssets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-2 py-8 text-center text-muted-foreground"
                    >
                      Không có tài sản phòng phù hợp.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Tổng {filteredAssets.length} tài sản - Trang{" "}
              {Math.min(page, totalPages)}/{totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                Trước
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={handleAssetDialogOpenChange}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAssetId
                ? "Chỉnh sửa tài sản phòng"
                : "Thêm tài sản phòng"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium">Tên tài sản</label>
              <Input
                value={createForm.name}
                onChange={(event) =>
                  updateCreateFormField("name", event.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Loại tài sản</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={createForm.assetTypeId}
                onChange={(event) =>
                  updateCreateFormField("assetTypeId", event.target.value)
                }
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
                value={createForm.quantity}
                onChange={(event) =>
                  updateCreateFormField("quantity", event.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Đơn vị</label>
              <Input
                value={createForm.unit}
                placeholder="cái, bộ, chiếc..."
                onChange={(event) =>
                  updateCreateFormField("unit", event.target.value)
                }
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Trạng thái</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={createForm.status}
                onChange={(event) =>
                  updateCreateFormField("status", event.target.value)
                }
              >
                {ROOM_ASSET_STATUS_OPTIONS.map((option) => (
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
                value={createForm.conditionStatus}
                onChange={(event) =>
                  updateCreateFormField("conditionStatus", event.target.value)
                }
              >
                {ROOM_ASSET_CONDITION_OPTIONS.map((option) => (
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
                value={createForm.acquiredAt}
                onChange={(event) =>
                  updateCreateFormField("acquiredAt", event.target.value)
                }
              />
            </div>

            <div className="space-y-2 md:col-span-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Ảnh tài sản</label>
                <input
                  ref={imageUploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageFilesChange}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={openImagePicker}
                  disabled={uploadingImages || creatingAsset}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {uploadingImages ? "Đang upload..." : "Upload ảnh"}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {createForm.imageUrls.map((url) => (
                  <div
                    key={url}
                    className="space-y-2 rounded-md border bg-muted/20 p-2"
                  >
                    <img
                      src={resolveAssetImageUrl(
                        url,
                        effectiveAccessToken,
                        effectiveWorkspaceKey,
                      )}
                      alt="Ảnh tài sản"
                      className="h-28 w-full rounded object-cover"
                      loading="lazy"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          createForm.primaryImageUrl === url
                            ? "default"
                            : "outline"
                        }
                        className="flex-1"
                        onClick={() => setPrimaryImage(url)}
                      >
                        {createForm.primaryImageUrl === url
                          ? "Ảnh chính"
                          : "Đặt ảnh chính"}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => removeUploadedImage(url)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:col-span-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Thuộc tính mở rộng
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={appendMetadataField}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Thêm thuộc tính
                </Button>
              </div>
              <div className="space-y-2">
                {createMetadataEntries.map((entry, index) => (
                  <div
                    key={`create-metadata-${index}`}
                    className="grid gap-2 md:grid-cols-[1fr_2fr_auto]"
                  >
                    <Input
                      value={entry.key}
                      placeholder="Tên thuộc tính"
                      onChange={(event) =>
                        updateMetadataField(index, "key", event.target.value)
                      }
                    />
                    <Input
                      value={entry.value}
                      placeholder="Giá trị"
                      onChange={(event) =>
                        updateMetadataField(index, "value", event.target.value)
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => removeMetadataField(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1 md:col-span-3">
              <label className="text-sm font-medium">Ghi chú</label>
              <textarea
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createForm.note}
                onChange={(event) =>
                  updateCreateFormField("note", event.target.value)
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAssetDialog}>
              Đóng
            </Button>
            <Button
              type="button"
              onClick={() => void saveRoomAsset()}
              disabled={creatingAsset}
            >
              {creatingAsset
                ? "Đang lưu..."
                : editingAssetId
                  ? "Lưu chỉnh sửa"
                  : "Lưu tài sản"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết tài sản phòng</DialogTitle>
          </DialogHeader>
          {detailAsset ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 md:grid-cols-2">
                <p>
                  Tên tài sản: <strong>{detailAsset.name}</strong>
                </p>
                <p>
                  Loại tài sản:{" "}
                  <strong>{detailAsset.asset_type_name || "-"}</strong>
                </p>
                <p>
                  Số lượng:{" "}
                  <strong>
                    {detailAsset.quantity}
                    {detailAsset.unit ? ` ${detailAsset.unit}` : ""}
                  </strong>
                </p>
                <p>
                  Trạng thái:{" "}
                  <strong>{getAssetStatusLabel(detailAsset.status)}</strong>
                </p>
                <p>
                  Tình trạng:{" "}
                  <strong>
                    {getConditionStatusLabel(detailAsset.condition_status)}
                  </strong>
                </p>
                <p>
                  Ngày tiếp nhận:{" "}
                  <strong>{formatDatetime(detailAsset.acquired_at)}</strong>
                </p>
                <p className="md:col-span-2">
                  Ghi chú: <strong>{detailAsset.note || "-"}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-medium">Thuộc tính mở rộng</p>
                {parseMetadataRows(detailAsset.metadata_json).length > 0 ? (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-2 py-2">Thuộc tính</th>
                          <th className="px-2 py-2">Giá trị</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parseMetadataRows(detailAsset.metadata_json).map(
                          ([key, value]) => (
                            <tr key={key} className="border-b">
                              <td className="px-2 py-2">{key}</td>
                              <td className="px-2 py-2">{value || "-"}</td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Không có thuộc tính mở rộng.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="font-medium">Hình ảnh</p>
                {detailAsset.images.length > 0 ||
                (detailAsset.primary_image_url || "").trim().length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {(detailAsset.images.length > 0
                      ? detailAsset.images.map((image) => image.image_url)
                      : [detailAsset.primary_image_url || ""]
                    )
                      .map((rawUrl) => rawUrl.trim())
                      .filter((rawUrl) => rawUrl.length > 0)
                      .map((rawUrl) => (
                        <div
                          key={rawUrl}
                          className="overflow-hidden rounded-md border bg-muted/10"
                        >
                          <img
                            src={resolveAssetImageUrl(
                              rawUrl,
                              effectiveAccessToken,
                              effectiveWorkspaceKey,
                            )}
                            alt="Ảnh tài sản"
                            className="h-40 w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Không có ảnh tài sản.</p>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDetailOpen(false)}
            >
              <X className="mr-1 h-4 w-4" />
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
