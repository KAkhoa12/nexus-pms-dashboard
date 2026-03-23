import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowRight, Eye, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { areasApi } from "@/features/areas/api/areas.api";
import type {
  Area,
  Branch,
  Building,
  Room,
  RoomType,
} from "@/features/ops/types";
import { branchesApi } from "@/features/branches/api/branches.api";
import { buildingsApi } from "@/features/buildings/api/buildings.api";
import { materialsAssetsApi } from "@/features/materials-assets/api/materials-assets.api";
import { roomTypesApi } from "@/features/room-types/api/room-types.api";
import { roomsApi } from "@/features/rooms/api/rooms.api";

type ApiErrorBody = { message?: string };

const MAX_LOOP_PAGES = 20;

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

export function RoomAssetsPage() {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [assetCountByRoom, setAssetCountByRoom] = useState<
    Record<number, number>
  >({});

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("ALL");
  const [areaFilter, setAreaFilter] = useState<string>("ALL");
  const [buildingFilter, setBuildingFilter] = useState<string>("ALL");
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [allRooms, branchData, areaData, buildingData, roomTypeData] =
        await Promise.all([
          loadAllRooms(),
          branchesApi.list("active"),
          loadAllAreas(),
          buildingsApi.list("active"),
          roomTypesApi.list("active"),
        ]);
      setRooms(allRooms);
      setBranches(branchData);
      setAreas(areaData);
      setBuildings(buildingData);
      setRoomTypes(roomTypeData);
      setAssetCountByRoom(await loadRoomAssetCounts());
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể tải dữ liệu tài sản phòng."),
      );
    } finally {
      setLoading(false);
    }
  }

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

  async function loadRoomAssetCounts(): Promise<Record<number, number>> {
    const counts: Record<number, number> = {};
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= totalPages && currentPage <= MAX_LOOP_PAGES) {
      const response = await materialsAssetsApi.list({
        mode: "active",
        page: currentPage,
        itemsPerPage: 500,
        ownerScope: "ROOM",
      });
      response.items.forEach((item) => {
        const roomId = Number(item.room_id || 0);
        if (!roomId) return;
        counts[roomId] = (counts[roomId] || 0) + 1;
      });
      totalPages = Math.max(1, response.pagination.total_pages);
      currentPage += 1;
    }

    return counts;
  }

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

  const filteredRooms = useMemo(() => {
    const normalizedQuery = search.trim().toLowerCase();
    return rooms.filter((room) => {
      if (branchFilter !== "ALL" && room.branch_id !== Number(branchFilter)) {
        return false;
      }
      if (areaFilter !== "ALL" && room.area_id !== Number(areaFilter)) {
        return false;
      }
      if (
        buildingFilter !== "ALL" &&
        room.building_id !== Number(buildingFilter)
      ) {
        return false;
      }
      if (
        roomTypeFilter !== "ALL" &&
        room.room_type_id !== Number(roomTypeFilter)
      ) {
        return false;
      }
      if (statusFilter !== "ALL" && room.current_status !== statusFilter) {
        return false;
      }
      if (!normalizedQuery) return true;

      const searchable = [
        room.code,
        branchMap.get(room.branch_id),
        areaMap.get(room.area_id),
        buildingMap.get(room.building_id),
        roomTypeMap.get(room.room_type_id),
        getRoomStatusLabel(room.current_status),
      ]
        .join(" ")
        .toLowerCase();
      return normalizedQuery
        .split(/\s+/)
        .every((token) => searchable.includes(token));
    });
  }, [
    areaFilter,
    areaMap,
    branchFilter,
    branchMap,
    buildingFilter,
    buildingMap,
    roomTypeFilter,
    roomTypeMap,
    rooms,
    search,
    statusFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRooms.length / pageSize));
  const pagedRooms = useMemo(() => {
    const normalizedPage = Math.min(page, totalPages);
    const start = (normalizedPage - 1) * pageSize;
    return filteredRooms.slice(start, start + pageSize);
  }, [filteredRooms, page, pageSize, totalPages]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  function openRoomAssets(roomId: number) {
    navigate(`/dashboard/room-assets/${roomId}`);
  }

  function addRoomAsset(roomId: number) {
    navigate(`/dashboard/room-assets/${roomId}?action=create`);
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý tài sản phòng</h1>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc phòng</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-7">
          <Input
            placeholder="Tìm theo mã phòng, tòa, khu vực..."
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={branchFilter}
            onChange={(event) => {
              setBranchFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Chi nhánh: Tất cả</option>
            {branches.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={areaFilter}
            onChange={(event) => {
              setAreaFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Khu vực: Tất cả</option>
            {areas.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={buildingFilter}
            onChange={(event) => {
              setBuildingFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Tòa nhà: Tất cả</option>
            {buildings.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={roomTypeFilter}
            onChange={(event) => {
              setRoomTypeFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Loại phòng: Tất cả</option>
            {roomTypes.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="ALL">Trạng thái: Tất cả</option>
            <option value="VACANT">Trống</option>
            <option value="DEPOSITED">Đã đặt cọc</option>
            <option value="RENTED">Đã thuê</option>
            <option value="MAINTENANCE">Đang sửa chữa</option>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách phòng và tài sản</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">Mã phòng</th>
                <th className="px-2 py-2">Chi nhánh</th>
                <th className="px-2 py-2">Khu vực</th>
                <th className="px-2 py-2">Tòa nhà</th>
                <th className="px-2 py-2">Loại phòng</th>
                <th className="px-2 py-2">Tầng</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Số tài sản</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pagedRooms.map((room) => (
                <tr key={room.id} className="border-b">
                  <td className="px-2 py-2 font-medium">{room.code}</td>
                  <td className="px-2 py-2">
                    {branchMap.get(room.branch_id) || `#${room.branch_id}`}
                  </td>
                  <td className="px-2 py-2">
                    {areaMap.get(room.area_id) || `#${room.area_id}`}
                  </td>
                  <td className="px-2 py-2">
                    {buildingMap.get(room.building_id) ||
                      `#${room.building_id}`}
                  </td>
                  <td className="px-2 py-2">
                    {roomTypeMap.get(room.room_type_id) ||
                      `#${room.room_type_id}`}
                  </td>
                  <td className="px-2 py-2">{room.floor_number}</td>
                  <td className="px-2 py-2">
                    {getRoomStatusLabel(room.current_status)}
                  </td>
                  <td className="px-2 py-2 font-medium">
                    {assetCountByRoom[room.id] || 0}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => openRoomAssets(room.id)}
                        title="Xem chi tiết tài sản phòng"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => addRoomAsset(room.id)}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Thêm tài sản
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && pagedRooms.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    Không có phòng phù hợp bộ lọc.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Tổng {filteredRooms.length} phòng - Trang{" "}
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

          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
            <ArrowRight className="h-4 w-4 shrink-0" />
            Chọn "Thêm tài sản" để chuyển sang form tạo tài sản và gán trực tiếp
            cho phòng đã chọn.
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
