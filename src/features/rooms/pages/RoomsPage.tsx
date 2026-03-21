import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Eye, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { areasApi } from "@/features/areas/api/areas.api";
import { branchesApi } from "@/features/branches/api/branches.api";
import { buildingsApi } from "@/features/buildings/api/buildings.api";
import type {
  Area,
  Branch,
  Building,
  Room,
  RoomType,
} from "@/features/ops/types";
import { roomTypesApi } from "@/features/room-types/api/room-types.api";
import { roomsApi } from "@/features/rooms/api/rooms.api";

type ApiErrorBody = { message?: string };

type RoomFormState = {
  branch_id: string;
  area_id: string;
  building_id: string;
  room_type_id: string;
  floor_number: string;
  code: string;
  current_status: "VACANT" | "DEPOSITED" | "RENTED" | "MAINTENANCE";
  current_price: string;
};

type BranchFormState = {
  name: string;
};

type AreaFormState = {
  name: string;
  address: string;
};

type BuildingFormState = {
  name: string;
  total_floors: string;
};

const DEFAULT_ROOM_FORM: RoomFormState = {
  branch_id: "",
  area_id: "",
  building_id: "",
  room_type_id: "",
  floor_number: "1",
  code: "",
  current_status: "VACANT",
  current_price: "0",
};

const DEFAULT_BRANCH_FORM: BranchFormState = {
  name: "",
};

const DEFAULT_AREA_FORM: AreaFormState = {
  name: "",
  address: "",
};

const DEFAULT_BUILDING_FORM: BuildingFormState = {
  name: "",
  total_floors: "1",
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function getRoomStatusMeta(status: string): {
  label: string;
  className: string;
} {
  if (status === "VACANT") {
    return {
      label: "Trống",
      className: "border-slate-300 bg-white text-slate-900",
    };
  }
  if (status === "DEPOSITED") {
    return {
      label: "Đặt cọc",
      className: "border-amber-300 bg-amber-100 text-amber-900",
    };
  }
  if (status === "RENTED") {
    return {
      label: "Đã thuê",
      className: "border-rose-300 bg-rose-100 text-rose-900",
    };
  }
  return {
    label: "Đang sửa chữa",
    className: "border-sky-300 bg-sky-100 text-sky-900",
  };
}

async function fetchAllActiveRooms(): Promise<Room[]> {
  const allItems: Room[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await roomsApi.list({
      mode: "active",
      page,
      itemsPerPage: 200,
    });
    allItems.push(...response.items);
    totalPages = response.pagination.total_pages;
    page += 1;
  } while (page <= totalPages);
  return allItems;
}

async function fetchAllActiveAreas(): Promise<Area[]> {
  const allItems: Area[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = await areasApi.list({
      mode: "active",
      page,
      itemsPerPage: 200,
    });
    allItems.push(...response.items);
    totalPages = response.pagination.total_pages;
    page += 1;
  } while (page <= totalPages);
  return allItems;
}

export function RoomsPage() {
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  );
  const [roomSearch, setRoomSearch] = useState("");

  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false);
  const [isBuildingDialogOpen, setIsBuildingDialogOpen] = useState(false);

  const [branchForm, setBranchForm] =
    useState<BranchFormState>(DEFAULT_BRANCH_FORM);
  const [areaForm, setAreaForm] = useState<AreaFormState>(DEFAULT_AREA_FORM);
  const [buildingForm, setBuildingForm] = useState<BuildingFormState>(
    DEFAULT_BUILDING_FORM,
  );

  const [isRoomDialogOpen, setIsRoomDialogOpen] = useState(false);
  const [roomDialogReadonly, setRoomDialogReadonly] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [roomForm, setRoomForm] = useState<RoomFormState>(DEFAULT_ROOM_FORM);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!selectedBranchId) return;
    const exists = branches.some(
      (item) => String(item.id) === selectedBranchId,
    );
    if (!exists) {
      setSelectedBranchId(null);
      setSelectedAreaId(null);
      setSelectedBuildingId(null);
    }
  }, [branches, selectedBranchId]);

  useEffect(() => {
    if (!selectedAreaId || !selectedBranchId) return;
    const exists = areas.some(
      (item) =>
        String(item.id) === selectedAreaId &&
        String(item.branch_id) === selectedBranchId,
    );
    if (!exists) {
      setSelectedAreaId(null);
      setSelectedBuildingId(null);
    }
  }, [areas, selectedAreaId, selectedBranchId]);

  useEffect(() => {
    if (!selectedBuildingId || !selectedAreaId) return;
    const exists = buildings.some(
      (item) =>
        String(item.id) === selectedBuildingId &&
        String(item.area_id) === selectedAreaId,
    );
    if (!exists) {
      setSelectedBuildingId(null);
    }
  }, [buildings, selectedBuildingId, selectedAreaId]);

  async function loadData() {
    setLoading(true);
    try {
      const [branchItems, areaItems, buildingItems, roomTypeItems, roomItems] =
        await Promise.all([
          branchesApi.list("active", { itemsPerPage: 200 }),
          fetchAllActiveAreas(),
          buildingsApi.list("active"),
          roomTypesApi.list("active"),
          fetchAllActiveRooms(),
        ]);
      setBranches(branchItems);
      setAreas(areaItems);
      setBuildings(buildingItems);
      setRoomTypes(roomTypeItems);
      setRooms(roomItems);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải dữ liệu phòng."));
    } finally {
      setLoading(false);
    }
  }

  const areasInSelectedBranch = useMemo(() => {
    if (!selectedBranchId) return [];
    return areas.filter((item) => String(item.branch_id) === selectedBranchId);
  }, [areas, selectedBranchId]);

  const buildingsInSelectedArea = useMemo(() => {
    if (!selectedAreaId) return [];
    return buildings.filter((item) => String(item.area_id) === selectedAreaId);
  }, [buildings, selectedAreaId]);

  const roomsInSelectedBuilding = useMemo(() => {
    if (!selectedBuildingId) return [];
    const normalizedSearch = roomSearch.trim().toLowerCase();
    return rooms
      .filter((item) => String(item.building_id) === selectedBuildingId)
      .filter((item) =>
        normalizedSearch
          ? item.code.toLowerCase().includes(normalizedSearch)
          : true,
      )
      .sort((a, b) => {
        if (a.floor_number !== b.floor_number)
          return a.floor_number - b.floor_number;
        return a.code.localeCompare(b.code);
      });
  }, [rooms, selectedBuildingId, roomSearch]);

  const selectedBuilding = useMemo(
    () =>
      buildings.find((item) => String(item.id) === selectedBuildingId) ?? null,
    [buildings, selectedBuildingId],
  );

  const selectedBranch = useMemo(
    () => branches.find((item) => String(item.id) === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const selectedArea = useMemo(
    () => areas.find((item) => String(item.id) === selectedAreaId) ?? null,
    [areas, selectedAreaId],
  );

  const currentStep = useMemo(() => {
    if (!selectedBranchId) return 1;
    if (!selectedAreaId) return 2;
    if (!selectedBuildingId) return 3;
    return 4;
  }, [selectedAreaId, selectedBranchId, selectedBuildingId]);

  const roomTypeNameMap = useMemo(
    () => new Map(roomTypes.map((item) => [item.id, item.name])),
    [roomTypes],
  );

  const roomFloorOptions = useMemo(() => {
    const maxFloor = Math.max(1, selectedBuilding?.total_floors ?? 1);
    const options = Array.from({ length: maxFloor }, (_, idx) =>
      String(idx + 1),
    );
    if (roomForm.floor_number && !options.includes(roomForm.floor_number)) {
      return [...options, roomForm.floor_number];
    }
    return options;
  }, [selectedBuilding, roomForm.floor_number]);

  function createDefaultRoomForm(): RoomFormState {
    const branchId =
      selectedBranchId ?? (branches[0] ? String(branches[0].id) : "");
    const fallbackAreaId =
      areas.find((item) => String(item.branch_id) === branchId)?.id ?? null;
    const areaId =
      selectedAreaId ?? (fallbackAreaId ? String(fallbackAreaId) : "");
    const fallbackBuildingId =
      buildings.find((item) => String(item.area_id) === areaId)?.id ?? null;
    const buildingId =
      selectedBuildingId ??
      (fallbackBuildingId ? String(fallbackBuildingId) : "");
    const roomTypeId = roomTypes[0] ? String(roomTypes[0].id) : "";
    return {
      branch_id: branchId,
      area_id: areaId,
      building_id: buildingId,
      room_type_id: roomTypeId,
      floor_number: "1",
      code: "",
      current_status: "VACANT",
      current_price: "0",
    };
  }

  function applyRoomToForm(item: Room) {
    setRoomForm({
      branch_id: String(item.branch_id),
      area_id: String(item.area_id),
      building_id: String(item.building_id),
      room_type_id: String(item.room_type_id),
      floor_number: String(item.floor_number),
      code: item.code,
      current_status: item.current_status,
      current_price: item.current_price,
    });
  }

  function openCreateRoomDialog() {
    if (!selectedBranchId || !selectedAreaId || !selectedBuildingId) {
      toast.error(
        "Vui lòng chọn chi nhánh, khu vực và tòa nhà trước khi thêm phòng.",
      );
      return;
    }
    setEditingRoomId(null);
    setRoomDialogReadonly(false);
    setRoomForm(createDefaultRoomForm());
    setIsRoomDialogOpen(true);
  }

  function openDetailRoomDialog(item: Room, readonly = false) {
    setEditingRoomId(item.id);
    setRoomDialogReadonly(readonly);
    applyRoomToForm(item);
    setIsRoomDialogOpen(true);
  }

  function handleRoomBranchChange(nextBranchId: string) {
    const nextAreas = areas.filter(
      (item) => String(item.branch_id) === nextBranchId,
    );
    const nextAreaId = nextAreas[0] ? String(nextAreas[0].id) : "";
    const nextBuildings = buildings.filter(
      (item) => String(item.area_id) === nextAreaId,
    );
    const nextBuildingId = nextBuildings[0] ? String(nextBuildings[0].id) : "";
    setRoomForm((prev) => ({
      ...prev,
      branch_id: nextBranchId,
      area_id: nextAreaId,
      building_id: nextBuildingId,
      floor_number: "1",
    }));
  }

  function handleRoomAreaChange(nextAreaId: string) {
    const nextBuildings = buildings.filter(
      (item) => String(item.area_id) === nextAreaId,
    );
    const nextBuildingId = nextBuildings[0] ? String(nextBuildings[0].id) : "";
    setRoomForm((prev) => ({
      ...prev,
      area_id: nextAreaId,
      building_id: nextBuildingId,
      floor_number: "1",
    }));
  }

  function handleRoomBuildingChange(nextBuildingId: string) {
    const nextBuilding = buildings.find(
      (item) => String(item.id) === nextBuildingId,
    );
    const maxFloor = Math.max(1, nextBuilding?.total_floors ?? 1);
    setRoomForm((prev) => ({
      ...prev,
      building_id: nextBuildingId,
      floor_number:
        Number(prev.floor_number) <= maxFloor ? prev.floor_number : "1",
    }));
  }

  async function saveRoom() {
    try {
      if (!roomForm.branch_id || !roomForm.area_id || !roomForm.building_id) {
        toast.error("Vui lòng chọn đầy đủ chi nhánh, khu vực, tòa nhà.");
        return;
      }
      if (!roomForm.room_type_id) {
        toast.error("Vui lòng chọn loại phòng.");
        return;
      }
      if (!roomForm.code.trim()) {
        toast.error("Vui lòng nhập mã phòng.");
        return;
      }

      const payload = {
        branch_id: Number(roomForm.branch_id),
        area_id: Number(roomForm.area_id),
        building_id: Number(roomForm.building_id),
        room_type_id: Number(roomForm.room_type_id),
        floor_number: Number(roomForm.floor_number),
        code: roomForm.code.trim(),
        current_status: roomForm.current_status,
        current_price: roomForm.current_price,
      };

      if (!Number.isInteger(payload.floor_number) || payload.floor_number < 1) {
        toast.error("Tầng phải là số nguyên lớn hơn 0.");
        return;
      }

      if (editingRoomId) {
        await roomsApi.update(editingRoomId, payload);
        toast.success("Cập nhật phòng thành công.");
      } else {
        await roomsApi.create(payload);
        toast.success("Thêm phòng thành công.");
      }

      setIsRoomDialogOpen(false);
      await loadData();
      setSelectedBranchId(String(payload.branch_id));
      setSelectedAreaId(String(payload.area_id));
      setSelectedBuildingId(String(payload.building_id));
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu phòng thất bại."));
    }
  }

  async function softDeleteRoom(roomId: number) {
    try {
      await roomsApi.remove(roomId);
      toast.success("Xóa mềm phòng thành công.");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa phòng thất bại."));
    }
  }

  async function createBranch() {
    try {
      const name = branchForm.name.trim();
      if (!name) {
        toast.error("Vui lòng nhập tên chi nhánh.");
        return;
      }
      const created = await branchesApi.create({
        name,
      });
      toast.success("Thêm chi nhánh thành công.");
      setIsBranchDialogOpen(false);
      setBranchForm(DEFAULT_BRANCH_FORM);
      await loadData();
      setSelectedBranchId(String(created.id));
      setSelectedAreaId(null);
      setSelectedBuildingId(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể thêm chi nhánh."));
    }
  }

  async function createArea() {
    try {
      if (!selectedBranchId) {
        toast.error("Vui lòng chọn chi nhánh trước khi thêm khu vực.");
        return;
      }
      const name = areaForm.name.trim();
      if (!name) {
        toast.error("Vui lòng nhập tên khu vực.");
        return;
      }
      const created = await areasApi.create({
        branch_id: Number(selectedBranchId),
        name,
        address: areaForm.address.trim() || undefined,
      });
      toast.success("Thêm khu vực thành công.");
      setIsAreaDialogOpen(false);
      setAreaForm(DEFAULT_AREA_FORM);
      await loadData();
      setSelectedAreaId(String(created.id));
      setSelectedBuildingId(null);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể thêm khu vực."));
    }
  }

  async function createBuilding() {
    try {
      if (!selectedAreaId) {
        toast.error("Vui lòng chọn khu vực trước khi thêm tòa nhà.");
        return;
      }
      const name = buildingForm.name.trim();
      const totalFloors = Number(buildingForm.total_floors);
      if (!name) {
        toast.error("Vui lòng nhập tên tòa nhà.");
        return;
      }
      if (!Number.isInteger(totalFloors) || totalFloors < 1) {
        toast.error("Số tầng phải là số nguyên lớn hơn 0.");
        return;
      }
      const created = await buildingsApi.create({
        area_id: Number(selectedAreaId),
        name,
        total_floors: totalFloors,
      });
      toast.success("Thêm tòa nhà thành công.");
      setIsBuildingDialogOpen(false);
      setBuildingForm(DEFAULT_BUILDING_FORM);
      await loadData();
      setSelectedBuildingId(String(created.id));
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể thêm tòa nhà."));
    }
  }

  function handleSelectBranch(branchId: string) {
    setSelectedBranchId(branchId);
    setSelectedAreaId(null);
    setSelectedBuildingId(null);
  }

  function handleSelectArea(areaId: string) {
    setSelectedAreaId(areaId);
    setSelectedBuildingId(null);
  }

  function handleSelectBuilding(buildingId: string) {
    setSelectedBuildingId(buildingId);
  }

  const roomFormAreas = useMemo(() => {
    if (!roomForm.branch_id) return [];
    return areas.filter(
      (item) => String(item.branch_id) === roomForm.branch_id,
    );
  }, [areas, roomForm.branch_id]);

  const roomFormBuildings = useMemo(() => {
    if (!roomForm.area_id) return [];
    return buildings.filter(
      (item) => String(item.area_id) === roomForm.area_id,
    );
  }, [buildings, roomForm.area_id]);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý phòng trọ</h1>

      <Card>
        <CardHeader>
          <CardTitle>Luồng quản lý</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={`rounded-full border px-3 py-1 ${
              currentStep >= 1
                ? "border-primary bg-primary/10"
                : "border-border"
            }`}
          >
            1. Chi nhánh
          </span>
          <span className="text-muted-foreground">/</span>
          <span
            className={`rounded-full border px-3 py-1 ${
              currentStep >= 2
                ? "border-primary bg-primary/10"
                : "border-border"
            }`}
          >
            2. Khu vực
          </span>
          <span className="text-muted-foreground">/</span>
          <span
            className={`rounded-full border px-3 py-1 ${
              currentStep >= 3
                ? "border-primary bg-primary/10"
                : "border-border"
            }`}
          >
            3. Tòa nhà
          </span>
          <span className="text-muted-foreground">/</span>
          <span
            className={`rounded-full border px-3 py-1 ${
              currentStep >= 4
                ? "border-primary bg-primary/10"
                : "border-border"
            }`}
          >
            4. Phòng
          </span>
        </CardContent>
      </Card>

      {currentStep === 1 ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>1. Danh sách chi nhánh</CardTitle>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsBranchDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Thêm chi nhánh
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {branches.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectBranch(String(item.id))}
                  className="rounded-lg border border-border p-4 text-left transition hover:border-primary/60"
                >
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">ID: {item.id}</p>
                </button>
              ))}
              {!loading && branches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chưa có chi nhánh nào.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 2 ? (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                2. Danh sách khu vực trong chi nhánh{" "}
                {selectedBranch ? `- ${selectedBranch.name}` : ""}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedBranchId(null);
                    setSelectedAreaId(null);
                    setSelectedBuildingId(null);
                  }}
                >
                  Quay lại chi nhánh
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsAreaDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm khu vực
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {areasInSelectedBranch.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectArea(String(item.id))}
                  className="rounded-lg border border-border p-4 text-left transition hover:border-primary/60"
                >
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.address || "Chưa có địa chỉ"}
                  </p>
                </button>
              ))}
              {!loading && areasInSelectedBranch.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Chi nhánh này chưa có khu vực.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 3 ? (
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                3. Danh sách tòa nhà trong khu vực{" "}
                {selectedArea ? `- ${selectedArea.name}` : ""}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedAreaId(null);
                    setSelectedBuildingId(null);
                  }}
                >
                  Quay lại khu vực
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsBuildingDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm tòa nhà
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {buildingsInSelectedArea.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectBuilding(String(item.id))}
                  className="rounded-lg border border-border p-4 text-left transition hover:border-primary/60"
                >
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Số tầng: {item.total_floors}
                  </p>
                </button>
              ))}
              {!loading && buildingsInSelectedArea.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Khu vực này chưa có tòa nhà.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {currentStep === 4 ? (
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>
                4. Danh sách phòng hiện tại{" "}
                {selectedBuilding ? `- ${selectedBuilding.name}` : ""}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedBuildingId(null)}
                >
                  Quay lại tòa nhà
                </Button>
                <Button type="button" size="sm" onClick={openCreateRoomDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Thêm phòng
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-900">
                Trống
              </span>
              <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">
                Đặt cọc
              </span>
              <span className="inline-flex items-center rounded-full border border-rose-300 bg-rose-100 px-3 py-1 text-xs font-medium text-rose-900">
                Đã thuê
              </span>
              <span className="inline-flex items-center rounded-full border border-sky-300 bg-sky-100 px-3 py-1 text-xs font-medium text-sky-900">
                Đang sửa chữa
              </span>
            </div>
            <Input
              placeholder="Tìm theo mã phòng..."
              value={roomSearch}
              onChange={(event) => setRoomSearch(event.target.value)}
            />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Mã phòng</th>
                  <th className="px-2 py-2">Loại phòng</th>
                  <th className="px-2 py-2">Tầng</th>
                  <th className="px-2 py-2">Trạng thái</th>
                  <th className="px-2 py-2">Giá hiện tại</th>
                  <th className="px-2 py-2 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {roomsInSelectedBuilding.map((item) => {
                  const statusMeta = getRoomStatusMeta(item.current_status);
                  return (
                    <tr
                      key={item.id}
                      className="cursor-pointer border-b hover:bg-muted/40"
                      onClick={() => openDetailRoomDialog(item)}
                    >
                      <td className="px-2 py-2">{item.id}</td>
                      <td className="px-2 py-2 font-medium">{item.code}</td>
                      <td className="px-2 py-2">
                        {roomTypeNameMap.get(item.room_type_id) ??
                          `#${item.room_type_id}`}
                      </td>
                      <td className="px-2 py-2">{item.floor_number}</td>
                      <td className="px-2 py-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${statusMeta.className}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="px-2 py-2">{item.current_price}</td>
                      <td
                        className="px-2 py-2 text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => openDetailRoomDialog(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            onClick={() => void softDeleteRoom(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!loading && roomsInSelectedBuilding.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-2 py-6 text-center text-muted-foreground"
                    >
                      Chưa có phòng trong tòa nhà này.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
      ) : null}

      <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm chi nhánh</DialogTitle>
            <DialogDescription>Nhập thông tin chi nhánh mới.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tên chi nhánh</Label>
              <Input
                value={branchForm.name}
                onChange={(event) =>
                  setBranchForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBranchDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button onClick={() => void createBranch()}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAreaDialogOpen} onOpenChange={setIsAreaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm khu vực</DialogTitle>
            <DialogDescription>
              Thêm khu vực vào chi nhánh đang chọn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tên khu vực</Label>
              <Input
                value={areaForm.name}
                onChange={(event) =>
                  setAreaForm((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Địa chỉ khu vực</Label>
              <Input
                value={areaForm.address}
                onChange={(event) =>
                  setAreaForm((prev) => ({
                    ...prev,
                    address: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAreaDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button onClick={() => void createArea()}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isBuildingDialogOpen}
        onOpenChange={setIsBuildingDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm tòa nhà</DialogTitle>
            <DialogDescription>
              Thêm tòa nhà vào khu vực đang chọn.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Tên tòa nhà</Label>
              <Input
                value={buildingForm.name}
                onChange={(event) =>
                  setBuildingForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Tổng số tầng</Label>
              <Input
                type="number"
                min={1}
                value={buildingForm.total_floors}
                onChange={(event) =>
                  setBuildingForm((prev) => ({
                    ...prev,
                    total_floors: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBuildingDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button onClick={() => void createBuilding()}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRoomDialogOpen} onOpenChange={setIsRoomDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editingRoomId ? "Chi tiết phòng" : "Thêm phòng"}
            </DialogTitle>
            <DialogDescription>
              {editingRoomId
                ? "Xem/cập nhật thông tin phòng."
                : "Nhập thông tin để tạo phòng mới."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Chi nhánh</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={roomForm.branch_id}
                onChange={(e) => handleRoomBranchChange(e.target.value)}
                disabled={roomDialogReadonly}
              >
                <option value="">Chọn chi nhánh</option>
                {branches.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Khu vực</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={roomForm.area_id}
                onChange={(e) => handleRoomAreaChange(e.target.value)}
                disabled={roomDialogReadonly}
              >
                <option value="">Chọn khu vực</option>
                {roomFormAreas.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Tòa nhà</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={roomForm.building_id}
                onChange={(e) => handleRoomBuildingChange(e.target.value)}
                disabled={roomDialogReadonly}
              >
                <option value="">Chọn tòa nhà</option>
                {roomFormBuildings.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Loại phòng</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={roomForm.room_type_id}
                onChange={(e) =>
                  setRoomForm((p) => ({ ...p, room_type_id: e.target.value }))
                }
                disabled={roomDialogReadonly}
              >
                <option value="">Chọn loại phòng</option>
                {roomTypes.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Tầng</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={roomForm.floor_number}
                onChange={(e) =>
                  setRoomForm((p) => ({ ...p, floor_number: e.target.value }))
                }
                disabled={roomDialogReadonly}
              >
                {roomFloorOptions.map((floor) => (
                  <option key={floor} value={floor}>
                    Tầng {floor}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Mã phòng</Label>
              <Input
                value={roomForm.code}
                onChange={(e) =>
                  setRoomForm((p) => ({ ...p, code: e.target.value }))
                }
                disabled={roomDialogReadonly}
              />
            </div>

            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={roomForm.current_status}
                onChange={(e) =>
                  setRoomForm((p) => ({
                    ...p,
                    current_status: e.target.value as
                      | "VACANT"
                      | "DEPOSITED"
                      | "RENTED"
                      | "MAINTENANCE",
                  }))
                }
                disabled={roomDialogReadonly}
              >
                <option value="VACANT">Trống</option>
                <option value="DEPOSITED">Đặt cọc</option>
                <option value="RENTED">Đang thuê</option>
                <option value="MAINTENANCE">Đang sửa chữa</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Giá hiện tại</Label>
              <Input
                value={roomForm.current_price}
                onChange={(e) =>
                  setRoomForm((p) => ({ ...p, current_price: e.target.value }))
                }
                disabled={roomDialogReadonly}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRoomDialogOpen(false)}
            >
              Đóng
            </Button>
            <Button
              onClick={() => void saveRoom()}
              disabled={roomDialogReadonly}
            >
              {editingRoomId ? "Lưu thay đổi" : "Thêm mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
