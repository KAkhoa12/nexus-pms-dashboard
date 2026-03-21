import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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
import { roomsApi } from "@/features/rooms/api/rooms.api";
import { roomTypesApi } from "@/features/room-types/api/room-types.api";

type ApiErrorBody = { message?: string };

type FloorSummary = {
  floor: number;
  roomsOnFloor: Room[];
};

type NormalizedRoomStatus = "VACANT" | "DEPOSITED" | "RENTED" | "MAINTENANCE";

type RoomStatusMeta = {
  key: NormalizedRoomStatus;
  label: string;
  className: string;
};

type BuildingRoomStat = {
  total: number;
  vacant: number;
  deposited: number;
  rented: number;
  maintenance: number;
  occupied: number;
  occupancyRate: number;
};

const ROOM_STATUS_META: Record<NormalizedRoomStatus, RoomStatusMeta> = {
  VACANT: {
    key: "VACANT",
    label: "Trống",
    className: "bg-white text-slate-800 border-slate-300",
  },
  DEPOSITED: {
    key: "DEPOSITED",
    label: "Đã đặt cọc",
    className: "bg-amber-100 text-amber-900 border-amber-300",
  },
  RENTED: {
    key: "RENTED",
    label: "Đang thuê",
    className: "bg-rose-100 text-rose-900 border-rose-300",
  },
  MAINTENANCE: {
    key: "MAINTENANCE",
    label: "Đang sửa chữa",
    className: "bg-sky-100 text-sky-900 border-sky-300",
  },
};

function normalizeRoomStatus(statusRaw: string): NormalizedRoomStatus {
  if (statusRaw === "VACANT") return "VACANT";
  if (statusRaw === "DEPOSITED") return "DEPOSITED";
  if (statusRaw === "RENTED") return "RENTED";
  return "MAINTENANCE";
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

async function fetchAllRoomsActive(): Promise<Room[]> {
  let page = 1;
  let totalPages = 1;
  const all: Room[] = [];
  do {
    const response = await roomsApi.list({
      mode: "active",
      page,
      itemsPerPage: 200,
    });
    all.push(...response.items);
    totalPages = response.pagination.total_pages;
    page += 1;
  } while (page <= totalPages);
  return all;
}

export function ApartmentMapPage() {
  const navigate = useNavigate();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterBranchId, setFilterBranchId] = useState<string>("all");
  const [filterAreaId, setFilterAreaId] = useState<string>("all");

  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null,
  );
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [branchItems, areaResp, buildingItems, roomTypeItems, roomItems] =
        await Promise.all([
          branchesApi.list("active", { itemsPerPage: 200 }),
          areasApi.list({
            mode: "active",
            page: 1,
            itemsPerPage: 200,
          }),
          buildingsApi.list("active"),
          roomTypesApi.list("active"),
          fetchAllRoomsActive(),
        ]);
      setBranches(branchItems);
      setAreas(areaResp.items);
      setBuildings(buildingItems);
      setRoomTypes(roomTypeItems);
      setRooms(roomItems);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải sơ đồ căn hộ."));
    } finally {
      setLoading(false);
    }
  }

  const areaMap = useMemo(
    () => new Map(areas.map((item) => [item.id, item])),
    [areas],
  );
  const branchMap = useMemo(
    () => new Map(branches.map((item) => [item.id, item])),
    [branches],
  );
  const buildingMap = useMemo(
    () => new Map(buildings.map((item) => [item.id, item])),
    [buildings],
  );
  const roomTypeMap = useMemo(
    () => new Map(roomTypes.map((item) => [item.id, item])),
    [roomTypes],
  );

  const filteredAreas = useMemo(() => {
    if (filterBranchId === "all") return areas;
    return areas.filter((item) => String(item.branch_id) === filterBranchId);
  }, [areas, filterBranchId]);

  const filteredBuildings = useMemo(() => {
    return buildings.filter((building) => {
      const area = areaMap.get(building.area_id);
      if (!area) return false;
      if (
        filterBranchId !== "all" &&
        String(area.branch_id) !== filterBranchId
      ) {
        return false;
      }
      if (filterAreaId !== "all" && String(building.area_id) !== filterAreaId) {
        return false;
      }
      return true;
    });
  }, [buildings, areaMap, filterBranchId, filterAreaId]);

  const roomsByBuildingAndFloor = useMemo(() => {
    const map = new Map<number, Map<number, Room[]>>();
    for (const room of rooms) {
      if (!map.has(room.building_id))
        map.set(room.building_id, new Map<number, Room[]>());
      const floorMap = map.get(room.building_id);
      if (!floorMap) continue;
      const current = floorMap.get(room.floor_number) ?? [];
      floorMap.set(room.floor_number, [...current, room]);
    }

    for (const floorMap of map.values()) {
      for (const [floor, floorRooms] of floorMap.entries()) {
        floorMap.set(
          floor,
          [...floorRooms].sort((a, b) => a.code.localeCompare(b.code)),
        );
      }
    }
    return map;
  }, [rooms]);

  const buildingStats = useMemo(() => {
    const stats = new Map<number, BuildingRoomStat>();
    rooms.forEach((room) => {
      const current = stats.get(room.building_id) ?? {
        total: 0,
        vacant: 0,
        deposited: 0,
        rented: 0,
        maintenance: 0,
        occupied: 0,
        occupancyRate: 0,
      };

      const status = normalizeRoomStatus(String(room.current_status));
      current.total += 1;
      if (status === "VACANT") current.vacant += 1;
      if (status === "DEPOSITED") current.deposited += 1;
      if (status === "RENTED") current.rented += 1;
      if (status === "MAINTENANCE") current.maintenance += 1;
      stats.set(room.building_id, current);
    });

    stats.forEach((value) => {
      value.occupied = value.total - value.vacant;
      value.occupancyRate =
        value.total > 0
          ? Math.round((value.occupied / value.total) * 1000) / 10
          : 0;
    });

    return stats;
  }, [rooms]);

  const getFloorSummaries = useCallback(
    (building: Building): FloorSummary[] => {
      const floorMap = roomsByBuildingAndFloor.get(building.id) ?? new Map();
      const floors: FloorSummary[] = [];
      for (let floor = building.total_floors; floor >= 1; floor -= 1) {
        floors.push({
          floor,
          roomsOnFloor: floorMap.get(floor) ?? [],
        });
      }
      return floors;
    },
    [roomsByBuildingAndFloor],
  );

  function onBranchChange(next: string) {
    setFilterBranchId(next);
    if (next === "all") return;
    const nextAreas = areas.filter((item) => String(item.branch_id) === next);
    const hasCurrentArea = nextAreas.some(
      (item) => String(item.id) === filterAreaId,
    );
    if (!hasCurrentArea) {
      setFilterAreaId("all");
    }
  }

  function openRoomEditor(room: Room) {
    setSelectedRoom(room);
  }

  const detailFloorSummaries = useMemo(() => {
    if (!selectedBuilding) return [];
    return getFloorSummaries(selectedBuilding);
  }, [getFloorSummaries, selectedBuilding]);

  const totalRoomsInDetail = useMemo(
    () =>
      detailFloorSummaries.reduce(
        (total, floor) => total + floor.roomsOnFloor.length,
        0,
      ),
    [detailFloorSummaries],
  );
  const selectedBuildingStat = selectedBuilding
    ? buildingStats.get(selectedBuilding.id)
    : undefined;
  const selectedRoomStatus = selectedRoom
    ? normalizeRoomStatus(String(selectedRoom.current_status))
    : null;
  const selectedRoomStatusMeta = selectedRoomStatus
    ? ROOM_STATUS_META[selectedRoomStatus]
    : null;
  const selectedRoomBuilding = selectedRoom
    ? (buildingMap.get(selectedRoom.building_id) ?? null)
    : null;
  const selectedRoomArea = selectedRoom
    ? (areaMap.get(selectedRoom.area_id) ?? null)
    : null;
  const selectedRoomBranch = selectedRoom
    ? (branchMap.get(selectedRoom.branch_id) ?? null)
    : null;
  const selectedRoomType = selectedRoom
    ? (roomTypeMap.get(selectedRoom.room_type_id) ?? null)
    : null;

  function handleCreateLeaseContract() {
    if (!selectedRoom || !selectedRoomStatus) return;
    if (selectedRoomStatus !== "VACANT") {
      toast.error("Chỉ có thể tạo hợp đồng khi phòng đang ở trạng thái trống.");
      return;
    }
    const roomId = selectedRoom.id;
    const buildingId = selectedRoom.building_id;
    setSelectedRoom(null);
    setSelectedBuilding(null);
    navigate(
      `/dashboard/contracts/create?room_id=${roomId}&building_id=${buildingId}`,
    );
    toast.info("Đã chuyển sang trang hợp đồng để tạo hợp đồng thuê phòng.");
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Sơ đồ căn hộ</h1>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Chi nhánh</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={filterBranchId}
              onChange={(e) => onBranchChange(e.target.value)}
            >
              <option value="all">Tất cả chi nhánh</option>
              {branches.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Khu vực</label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={filterAreaId}
              onChange={(e) => setFilterAreaId(e.target.value)}
            >
              <option value="all">Tất cả khu vực</option>
              {filteredAreas.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={() => void loadData()}>
              Tải lại dữ liệu
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filteredBuildings.map((building) => {
          const area = areaMap.get(building.area_id);
          const branch = area ? branchMap.get(area.branch_id) : null;
          const floorSummaries = getFloorSummaries(building);
          const stat = buildingStats.get(building.id);
          const occupancyRate = stat?.occupancyRate ?? 0;
          const occupiedRooms = stat?.occupied ?? 0;
          const totalRooms = stat?.total ?? 0;
          return (
            <Card key={building.id}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">{building.name}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {branch?.name ?? "N/A"} - {area?.name ?? "N/A"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Tỷ lệ lấp đầy:{" "}
                  <span className="font-medium text-foreground">
                    {occupancyRate.toFixed(1)}%
                  </span>{" "}
                  ({occupiedRooms}/{totalRooms})
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${occupancyRate}%` }}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="mx-auto w-full max-w-[240px]">
                  <div className="mx-auto h-2 w-20 rounded-t-md border-x-2 border-t-2 border-border/80 bg-muted/40" />
                  <div className="overflow-hidden rounded-md border-2 border-border/80 bg-background shadow-sm">
                    {floorSummaries.map((floorInfo, idx) => (
                      <div
                        key={`${building.id}-${floorInfo.floor}`}
                        className={`flex items-center justify-between px-3 py-2 text-xs ${
                          idx !== floorSummaries.length - 1
                            ? "border-b border-border/60"
                            : ""
                        }`}
                      >
                        <span className="font-medium">
                          Tầng {floorInfo.floor}
                        </span>
                        <span className="text-muted-foreground">
                          {floorInfo.roomsOnFloor.length} phòng
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedBuilding(building)}
                >
                  Xem chi tiết
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && filteredBuildings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Không có tòa nhà nào phù hợp với bộ lọc hiện tại.
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">
          Đang tải sơ đồ căn hộ...
        </p>
      ) : null}

      <Dialog
        open={Boolean(selectedBuilding)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedBuilding(null);
            setSelectedRoom(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Chi tiết tòa nhà: {selectedBuilding?.name ?? ""}
            </DialogTitle>
            <DialogDescription>
              Tổng số phòng và danh sách phòng theo từng tầng.
            </DialogDescription>
          </DialogHeader>
          <Card>
            <CardHeader>
              <CardTitle>Chú thích trạng thái phòng</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.values(ROOM_STATUS_META).map((meta) => (
                  <span
                    key={meta.key}
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="space-y-3">
            <div className="rounded-md border p-3 text-sm">
              <p>
                Tổng số tầng:{" "}
                <span className="font-medium">
                  {selectedBuilding?.total_floors ?? 0}
                </span>
              </p>
              <p>
                Tổng số phòng:{" "}
                <span className="font-medium">{totalRoomsInDetail}</span>
              </p>
              <p>
                Tỷ lệ lấp đầy:{" "}
                <span className="font-medium">
                  {(selectedBuildingStat?.occupancyRate ?? 0).toFixed(1)}%
                </span>
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {detailFloorSummaries.map((item) => (
                <div
                  key={`detail-floor-${item.floor}`}
                  className="rounded-md border p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">Tầng {item.floor}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.roomsOnFloor.length} phòng
                    </p>
                  </div>

                  {item.roomsOnFloor.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto rounded-md bg-muted/30 p-3">
                      <div className="flex flex-wrap gap-2">
                        {item.roomsOnFloor.map((room) => {
                          const statusMeta =
                            ROOM_STATUS_META[
                              normalizeRoomStatus(String(room.current_status))
                            ];
                          return (
                            <button
                              key={`detail-floor-${item.floor}-room-${room.id}`}
                              type="button"
                              title={`${room.code} - ${statusMeta.label}. Bấm để chỉnh sửa.`}
                              onClick={() => openRoomEditor(room)}
                              className={`min-w-[136px] rounded-lg border px-4 py-2 text-base font-semibold tracking-wide transition hover:scale-[1.02] ${statusMeta.className}`}
                            >
                              {room.code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Không có phòng ở tầng này.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedBuilding(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(selectedRoom)}
        onOpenChange={(open) => {
          if (!open) setSelectedRoom(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Phòng: {selectedRoom?.code ?? ""}</DialogTitle>
            <DialogDescription>
              Thông tin tổng quan phòng và hành động theo trạng thái hiện tại.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border p-4 text-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">
                Trạng thái hiện tại:
              </span>
              {selectedRoomStatusMeta ? (
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${selectedRoomStatusMeta.className}`}
                >
                  {selectedRoomStatusMeta.label}
                </span>
              ) : null}
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Mã phòng:</span>{" "}
                <span className="font-medium">{selectedRoom?.code ?? "-"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Loại phòng:</span>{" "}
                <span className="font-medium">
                  {selectedRoomType?.name ?? "-"}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Tầng:</span>{" "}
                <span className="font-medium">
                  {selectedRoom?.floor_number ?? "-"}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Giá hiện tại:</span>{" "}
                <span className="font-medium">
                  {selectedRoom?.current_price ?? "-"}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Tòa nhà:</span>{" "}
                <span className="font-medium">
                  {selectedRoomBuilding?.name ?? "-"}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Khu vực:</span>{" "}
                <span className="font-medium">
                  {selectedRoomArea?.name ?? "-"}
                </span>
              </p>
              <p className="md:col-span-2">
                <span className="text-muted-foreground">Chi nhánh:</span>{" "}
                <span className="font-medium">
                  {selectedRoomBranch?.name ?? "-"}
                </span>
              </p>
            </div>
          </div>

          {selectedRoomStatus === "VACANT" ? (
            <Button type="button" onClick={handleCreateLeaseContract}>
              Tạo hợp đồng thuê phòng
            </Button>
          ) : (
            <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              {selectedRoomStatus === "DEPOSITED"
                ? "Phòng đang ở trạng thái đã đặt cọc. Tạm thời chỉ cho phép tạo hợp đồng từ phòng trống."
                : selectedRoomStatus === "RENTED"
                  ? "Phòng đang ở trạng thái đã thuê. Không thể tạo hợp đồng mới từ popup này."
                  : "Phòng đang sửa chữa. Hãy chuyển phòng về trạng thái trống trước khi tạo hợp đồng mới."}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedRoom(null)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
