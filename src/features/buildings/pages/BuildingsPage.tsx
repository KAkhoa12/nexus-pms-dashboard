import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Eye, Trash2 } from "lucide-react";
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
import { buildingsApi } from "@/features/buildings/api/buildings.api";
import type {
  Area,
  Building,
  DeletedMode,
  Room,
  RoomType,
} from "@/features/ops/types";
import { roomTypesApi } from "@/features/room-types/api/room-types.api";
import { roomsApi } from "@/features/rooms/api/rooms.api";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function translateRoomStatus(status: Room["current_status"]): string {
  if (status === "VACANT") return "Trống";
  if (status === "DEPOSITED") return "Đặt cọc";
  if (status === "RENTED") return "Đang thuê";
  return "Đang sửa chữa";
}

type BuildingFormState = {
  areaId: string;
  name: string;
  totalFloors: string;
};

type AddRoomFormState = {
  floor_number: string;
  room_type_id: string;
  code: string;
  current_status: "VACANT" | "DEPOSITED" | "RENTED" | "MAINTENANCE";
  current_price: string;
};

const DEFAULT_FORM: BuildingFormState = {
  areaId: "",
  name: "",
  totalFloors: "1",
};

const DEFAULT_ADD_ROOM_FORM: AddRoomFormState = {
  floor_number: "1",
  room_type_id: "",
  code: "",
  current_status: "VACANT",
  current_price: "0",
};

export function BuildingsPage() {
  const [items, setItems] = useState<Building[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [deletedMode, setDeletedMode] = useState<DeletedMode>("active");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogReadonly, setDialogReadonly] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activeEditTab, setActiveEditTab] = useState<"info" | "rooms">("info");
  const [form, setForm] = useState<BuildingFormState>(DEFAULT_FORM);

  const [buildingRooms, setBuildingRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [isAddRoomDialogOpen, setIsAddRoomDialogOpen] = useState(false);
  const [addRoomForm, setAddRoomForm] = useState<AddRoomFormState>(
    DEFAULT_ADD_ROOM_FORM,
  );

  useEffect(() => {
    void Promise.all([loadAreas(), loadRoomTypes()]);
  }, []);

  useEffect(() => {
    void loadItems();
  }, [deletedMode]);

  async function loadItems() {
    try {
      const data = await buildingsApi.list(deletedMode);
      setItems(data);
      setSelectedIds([]);
      setPage(1);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách tòa nhà."));
    }
  }

  async function loadAreas() {
    try {
      const data = await areasApi.list({
        mode: "active",
        page: 1,
        itemsPerPage: 200,
      });
      setAreas(data.items);
      if (data.items.length > 0) {
        setForm((prev) =>
          prev.areaId ? prev : { ...prev, areaId: String(data.items[0].id) },
        );
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách khu vực."));
    }
  }

  async function loadRoomTypes() {
    try {
      const data = await roomTypesApi.list("active");
      setRoomTypes(data);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể tải danh sách loại phòng."),
      );
    }
  }

  async function loadRoomsByBuilding(buildingId: number) {
    setRoomsLoading(true);
    try {
      let currentPage = 1;
      let totalPages = 1;
      const all: Room[] = [];

      do {
        const response = await roomsApi.list({
          mode: "active",
          page: currentPage,
          itemsPerPage: 200,
        });
        all.push(
          ...response.items.filter((room) => room.building_id === buildingId),
        );
        totalPages = response.pagination.total_pages;
        currentPage += 1;
      } while (currentPage <= totalPages);

      all.sort((a, b) => {
        if (a.floor_number !== b.floor_number) {
          return a.floor_number - b.floor_number;
        }
        return a.code.localeCompare(b.code);
      });
      setBuildingRooms(all);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách phòng."));
      setBuildingRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  }

  const areaNameMap = useMemo(
    () => new Map(areas.map((item) => [item.id, item.name])),
    [areas],
  );

  const roomTypeNameMap = useMemo(
    () => new Map(roomTypes.map((item) => [item.id, item.name])),
    [roomTypes],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      const areaName = areaNameMap.get(item.area_id) ?? "";
      return (
        String(item.id).includes(keyword) ||
        String(item.area_id).includes(keyword) ||
        item.name.toLowerCase().includes(keyword) ||
        String(item.total_floors).includes(keyword) ||
        areaName.toLowerCase().includes(keyword)
      );
    });
  }, [items, search, areaNameMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const allOnPageSelected =
    paged.length > 0 && paged.every((item) => selectedIds.includes(item.id));

  const areaOptions = useMemo(() => {
    const exists =
      form.areaId && areas.some((item) => String(item.id) === form.areaId);
    if (exists || !form.areaId) return areas;
    return [
      ...areas,
      {
        id: Number(form.areaId),
        tenant_id: 0,
        branch_id: 0,
        name: `#${form.areaId}`,
        deleted_at: null,
      },
    ];
  }, [areas, form.areaId]);

  const totalFloors = useMemo(() => {
    const floorCount = Number(form.totalFloors);
    if (!Number.isInteger(floorCount) || floorCount < 1) return 1;
    return floorCount;
  }, [form.totalFloors]);

  const floorNumbers = useMemo(
    () => Array.from({ length: totalFloors }, (_, idx) => idx + 1),
    [totalFloors],
  );

  function toggleSelectAllOnPage(checked: boolean) {
    if (checked) {
      const merged = new Set([...selectedIds, ...paged.map((item) => item.id)]);
      setSelectedIds([...merged]);
      return;
    }
    setSelectedIds(
      selectedIds.filter((id) => !paged.some((item) => item.id === id)),
    );
  }

  function toggleRowSelection(id: number, checked: boolean) {
    if (checked) {
      if (!selectedIds.includes(id)) setSelectedIds([...selectedIds, id]);
      return;
    }
    setSelectedIds(selectedIds.filter((item) => item !== id));
  }

  function openCreateDialog() {
    setEditingId(null);
    setDialogReadonly(false);
    setActiveEditTab("info");
    setBuildingRooms([]);
    setIsAddRoomDialogOpen(false);
    setForm({
      areaId: areas.length > 0 ? String(areas[0].id) : "",
      name: "",
      totalFloors: "1",
    });
    setIsDialogOpen(true);
  }

  function openDetailDialog(item: Building, readonly = false) {
    setEditingId(item.id);
    setDialogReadonly(readonly);
    setActiveEditTab("info");
    setForm({
      areaId: String(item.area_id),
      name: item.name,
      totalFloors: String(item.total_floors),
    });
    setBuildingRooms([]);
    setIsAddRoomDialogOpen(false);
    setAddRoomForm({
      ...DEFAULT_ADD_ROOM_FORM,
      room_type_id: roomTypes[0] ? String(roomTypes[0].id) : "",
    });
    setIsDialogOpen(true);
    void loadRoomsByBuilding(item.id);
  }

  function openAddRoomDialog(floorNumber: number) {
    if (dialogReadonly || !editingId) return;
    setAddRoomForm({
      floor_number: String(floorNumber),
      room_type_id: roomTypes[0] ? String(roomTypes[0].id) : "",
      code: "",
      current_status: "VACANT",
      current_price: "0",
    });
    setIsAddRoomDialogOpen(true);
  }

  async function saveItem() {
    try {
      if (!form.areaId) {
        toast.error("Vui lòng chọn khu vực.");
        return;
      }
      if (!form.name.trim()) {
        toast.error("Vui lòng nhập tên tòa nhà.");
        return;
      }
      const floors = Number(form.totalFloors);
      if (!Number.isInteger(floors) || floors < 1) {
        toast.error("Số tầng phải là số nguyên lớn hơn 0.");
        return;
      }

      const payload = {
        area_id: Number(form.areaId),
        name: form.name.trim(),
        total_floors: floors,
      };

      if (editingId) {
        await buildingsApi.update(editingId, payload);
        toast.success("Cập nhật tòa nhà thành công.");
      } else {
        await buildingsApi.create(payload);
        toast.success("Thêm tòa nhà thành công.");
      }
      setIsDialogOpen(false);
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu tòa nhà thất bại."));
    }
  }

  async function saveRoomForBuilding() {
    try {
      if (!editingId) return;
      if (!form.areaId) {
        toast.error("Thiếu thông tin khu vực của tòa nhà.");
        return;
      }
      const selectedArea = areas.find(
        (item) => item.id === Number(form.areaId),
      );
      if (!selectedArea) {
        toast.error("Không xác định được chi nhánh của khu vực.");
        return;
      }
      if (!addRoomForm.room_type_id) {
        toast.error("Vui lòng chọn loại phòng.");
        return;
      }
      if (!addRoomForm.code.trim()) {
        toast.error("Vui lòng nhập mã phòng.");
        return;
      }

      const payload = {
        branch_id: selectedArea.branch_id,
        area_id: Number(form.areaId),
        building_id: editingId,
        room_type_id: Number(addRoomForm.room_type_id),
        floor_number: Number(addRoomForm.floor_number),
        code: addRoomForm.code.trim(),
        current_status: addRoomForm.current_status,
        current_price: addRoomForm.current_price,
      };

      await roomsApi.create(payload);
      toast.success("Thêm phòng thành công.");
      setIsAddRoomDialogOpen(false);
      await loadRoomsByBuilding(editingId);
    } catch (error) {
      toast.error(getErrorMessage(error, "Thêm phòng thất bại."));
    }
  }

  async function softDeleteItem(itemId: number) {
    try {
      await buildingsApi.remove(itemId);
      toast.success("Xóa mềm tòa nhà thành công.");
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa tòa nhà thất bại."));
    }
  }

  async function bulkDeleteSelected() {
    if (selectedIds.length === 0) return;
    try {
      if (deletedMode === "trash") {
        await Promise.all(selectedIds.map((id) => buildingsApi.removeHard(id)));
        toast.success("Xóa cứng tòa nhà thành công.");
      } else {
        await Promise.all(selectedIds.map((id) => buildingsApi.remove(id)));
        toast.success("Xóa mềm tòa nhà thành công.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa tòa nhà thất bại."));
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý tòa nhà</h1>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Bộ lọc và thao tác</CardTitle>
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              placeholder="Tìm theo ID, tên tòa nhà, khu vực..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={deletedMode}
              onChange={(e) => setDeletedMode(e.target.value as DeletedMode)}
            >
              <option value="active">Đang hoạt động</option>
              <option value="trash">Thùng rác</option>
              <option value="all">Tất cả</option>
            </select>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="10">10 / trang</option>
              <option value="20">20 / trang</option>
              <option value="50">50 / trang</option>
            </select>
            <div className="flex gap-2">
              <Button onClick={openCreateDialog}>Thêm</Button>
              <Button
                variant={deletedMode === "trash" ? "destructive" : "outline"}
                onClick={() => void bulkDeleteSelected()}
                disabled={selectedIds.length === 0}
              >
                {deletedMode === "trash"
                  ? "Xóa cứng đã chọn"
                  : "Xóa mềm đã chọn"}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách tòa nhà</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={(e) => toggleSelectAllOnPage(e.target.checked)}
                  />
                </th>
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Khu vực</th>
                <th className="px-2 py-2">Tên</th>
                <th className="px-2 py-2">Số tầng</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() =>
                    openDetailDialog(item, deletedMode !== "active")
                  }
                >
                  <td
                    className="px-2 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) =>
                        toggleRowSelection(item.id, e.target.checked)
                      }
                    />
                  </td>
                  <td className="px-2 py-2">{item.id}</td>
                  <td className="px-2 py-2">
                    {areaNameMap.get(item.area_id) ?? `#${item.area_id}`}
                  </td>
                  <td className="px-2 py-2">{item.name}</td>
                  <td className="px-2 py-2">{item.total_floors}</td>
                  <td
                    className="px-2 py-2 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          openDetailDialog(item, deletedMode !== "active")
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        disabled={deletedMode !== "active"}
                        onClick={() => void softDeleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    Không có dữ liệu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Tổng {filtered.length} bản ghi
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Trước
              </Button>
              <span className="text-sm">
                Trang {safePage}/{totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Sau
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setIsAddRoomDialogOpen(false);
        }}
      >
        <DialogContent
          className={
            editingId
              ? "max-h-[88vh] overflow-y-auto sm:max-w-5xl"
              : "max-h-[85vh] overflow-y-auto sm:max-w-xl"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Chi tiết tòa nhà" : "Thêm tòa nhà"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Xem/cập nhật thông tin tòa nhà."
                : "Nhập thông tin để tạo tòa nhà mới."}
            </DialogDescription>
          </DialogHeader>

          {editingId ? (
            <div className="space-y-4">
              <div className="inline-flex rounded-md border p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={activeEditTab === "info" ? "default" : "ghost"}
                  onClick={() => setActiveEditTab("info")}
                >
                  Thông tin
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={activeEditTab === "rooms" ? "default" : "ghost"}
                  onClick={() => setActiveEditTab("rooms")}
                >
                  Phòng theo tầng
                </Button>
              </div>

              {activeEditTab === "info" ? (
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label>Khu vực</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3"
                      value={form.areaId}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, areaId: e.target.value }))
                      }
                      disabled={dialogReadonly}
                    >
                      <option value="">Chọn khu vực</option>
                      {areaOptions.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tên tòa nhà</Label>
                    <Input
                      value={form.name}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, name: e.target.value }))
                      }
                      disabled={dialogReadonly}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Số tầng</Label>
                    <Input
                      value={form.totalFloors}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, totalFloors: e.target.value }))
                      }
                      disabled={dialogReadonly}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Chọn tầng để thêm phòng mới cho tòa nhà này.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={dialogReadonly || floorNumbers.length === 0}
                      onClick={() =>
                        openAddRoomDialog(
                          floorNumbers[floorNumbers.length - 1] ?? 1,
                        )
                      }
                    >
                      Thêm phòng
                    </Button>
                  </div>

                  {roomsLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Đang tải phòng...
                    </p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {floorNumbers.map((floor) => {
                        const roomsOnFloor = buildingRooms.filter(
                          (room) => room.floor_number === floor,
                        );
                        return (
                          <button
                            key={floor}
                            type="button"
                            className="rounded-lg border p-3 text-left transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-80"
                            disabled={dialogReadonly}
                            onClick={() => openAddRoomDialog(floor)}
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Tầng {floor}</h4>
                              <span className="text-xs text-muted-foreground">
                                {roomsOnFloor.length} phòng
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {roomsOnFloor.length > 0 ? (
                                roomsOnFloor.map((room) => (
                                  <span
                                    key={room.id}
                                    className="rounded-full border px-2 py-1 text-xs"
                                  >
                                    {room.code} ·{" "}
                                    {roomTypeNameMap.get(room.room_type_id) ??
                                      `#${room.room_type_id}`}{" "}
                                    · {translateRoomStatus(room.current_status)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  Chưa có phòng
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Khu vực</Label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3"
                  value={form.areaId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, areaId: e.target.value }))
                  }
                  disabled={dialogReadonly}
                >
                  <option value="">Chọn khu vực</option>
                  {areaOptions.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Tên tòa nhà</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  disabled={dialogReadonly}
                />
              </div>
              <div className="space-y-2">
                <Label>Số tầng</Label>
                <Input
                  value={form.totalFloors}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, totalFloors: e.target.value }))
                  }
                  disabled={dialogReadonly}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Đóng
            </Button>
            <Button onClick={() => void saveItem()} disabled={dialogReadonly}>
              {editingId ? "Lưu thay đổi" : "Thêm mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddRoomDialogOpen} onOpenChange={setIsAddRoomDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thêm phòng trong tòa nhà</DialogTitle>
            <DialogDescription>
              Tạo nhanh phòng mới theo tầng trong tòa nhà hiện tại.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Tầng</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={addRoomForm.floor_number}
                onChange={(e) =>
                  setAddRoomForm((p) => ({
                    ...p,
                    floor_number: e.target.value,
                  }))
                }
              >
                {floorNumbers.map((floor) => (
                  <option key={floor} value={String(floor)}>
                    Tầng {floor}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Loại phòng</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={addRoomForm.room_type_id}
                onChange={(e) =>
                  setAddRoomForm((p) => ({
                    ...p,
                    room_type_id: e.target.value,
                  }))
                }
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
              <Label>Mã phòng</Label>
              <Input
                value={addRoomForm.code}
                onChange={(e) =>
                  setAddRoomForm((p) => ({ ...p, code: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={addRoomForm.current_status}
                onChange={(e) =>
                  setAddRoomForm((p) => ({
                    ...p,
                    current_status: e.target.value as
                      | "VACANT"
                      | "DEPOSITED"
                      | "RENTED"
                      | "MAINTENANCE",
                  }))
                }
              >
                <option value="VACANT">Trống</option>
                <option value="DEPOSITED">Đặt cọc</option>
                <option value="RENTED">Đang thuê</option>
                <option value="MAINTENANCE">Đang sửa chữa</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Giá hiện tại</Label>
              <Input
                value={addRoomForm.current_price}
                onChange={(e) =>
                  setAddRoomForm((p) => ({
                    ...p,
                    current_price: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddRoomDialogOpen(false)}
            >
              Đóng
            </Button>
            <Button onClick={() => void saveRoomForBuilding()}>
              Thêm phòng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
