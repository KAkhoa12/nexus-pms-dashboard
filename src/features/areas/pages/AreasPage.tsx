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
import { branchesApi } from "@/features/branches/api/branches.api";
import type { PaginationMeta } from "@/features/auth/types";
import type { Area, Branch, DeletedMode } from "@/features/ops/types";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function AreasPage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    items_per_page: 10,
    total_items: 0,
    total_pages: 1,
  });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [deletedMode, setDeletedMode] = useState<DeletedMode>("active");
  const [search, setSearch] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogReadonly, setDialogReadonly] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState<number | null>(null);
  const [branchId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    void loadBranches();
  }, []);

  useEffect(() => {
    void loadAreas();
  }, [deletedMode, page, pageSize, search, filterBranchId]);

  async function loadAreas() {
    try {
      const data = await areasApi.list({
        mode: deletedMode,
        page,
        itemsPerPage: pageSize,
        branchId: filterBranchId === "all" ? undefined : Number(filterBranchId),
        searchKey: search.trim() || undefined,
      });
      setAreas(data.items);
      setPagination(data.pagination);
      setSelectedIds([]);
      if (
        data.pagination.total_pages > 0 &&
        page > data.pagination.total_pages
      ) {
        setPage(data.pagination.total_pages);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách khu vực."));
    }
  }

  async function loadBranches() {
    try {
      const data = await branchesApi.list("active", { itemsPerPage: 200 });
      setBranches(data);
      if (!branchId && data.length > 0) {
        setBranchId(String(data[0].id));
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách chi nhánh."));
    }
  }

  const branchNameMap = useMemo(
    () => new Map(branches.map((item) => [item.id, item.name])),
    [branches],
  );

  const totalPages = Math.max(1, pagination.total_pages);
  const safePage = Math.min(page, totalPages);
  const pagedAreas = areas;

  const allOnPageSelected =
    pagedAreas.length > 0 &&
    pagedAreas.every((item) => selectedIds.includes(item.id));

  function toggleSelectAllOnPage(checked: boolean) {
    if (checked) {
      const merged = new Set([
        ...selectedIds,
        ...pagedAreas.map((item) => item.id),
      ]);
      setSelectedIds([...merged]);
      return;
    }
    setSelectedIds(
      selectedIds.filter((id) => !pagedAreas.some((item) => item.id === id)),
    );
  }

  function toggleRowSelection(id: number, checked: boolean) {
    if (checked) {
      if (!selectedIds.includes(id)) setSelectedIds([...selectedIds, id]);
      return;
    }
    setSelectedIds(selectedIds.filter((item) => item !== id));
  }

  function resetDialogForm() {
    setEditingAreaId(null);
    setDialogReadonly(false);
    setName("");
    setAddress("");
    if (branches.length > 0) setBranchId(String(branches[0].id));
  }

  function openCreateDialog() {
    resetDialogForm();
    setIsDialogOpen(true);
  }

  function openEditDialog(item: Area, readonly = false) {
    setEditingAreaId(item.id);
    setDialogReadonly(readonly);
    setName(item.name);
    setAddress(item.address || "");
    setBranchId(String(item.branch_id));
    setIsDialogOpen(true);
  }

  async function saveArea() {
    try {
      if (!branchId) {
        toast.error("Vui lòng chọn chi nhánh.");
        return;
      }
      if (!name.trim()) {
        toast.error("Vui lòng nhập tên khu vực.");
        return;
      }
      if (editingAreaId) {
        await areasApi.update(editingAreaId, {
          branch_id: Number(branchId),
          name: name.trim(),
          address: address.trim() || undefined,
        });
        toast.success("Cập nhật khu vực thành công.");
      } else {
        await areasApi.create({
          branch_id: Number(branchId),
          name: name.trim(),
          address: address.trim() || undefined,
        });
        toast.success("Thêm khu vực thành công.");
      }
      setIsDialogOpen(false);
      await loadAreas();
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu khu vực thất bại."));
    }
  }

  async function bulkDeleteSelected() {
    if (selectedIds.length === 0) return;
    try {
      if (deletedMode === "trash") {
        await Promise.all(selectedIds.map((id) => areasApi.removeHard(id)));
        toast.success("Xóa cứng khu vực thành công.");
      } else {
        await Promise.all(selectedIds.map((id) => areasApi.remove(id)));
        toast.success("Xóa mềm khu vực thành công.");
      }
      await loadAreas();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa khu vực thất bại."));
    }
  }

  async function softDeleteItem(areaId: number) {
    try {
      await areasApi.remove(areaId);
      toast.success("Xóa mềm khu vực thành công.");
      await loadAreas();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa khu vực thất bại."));
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý khu vực</h1>
      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Bộ lọc và thao tác</CardTitle>
          <div className="grid gap-3 md:grid-cols-5">
            <Input
              placeholder="Tìm theo tên khu vực, địa chỉ, tên chi nhánh..."
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
              value={filterBranchId}
              onChange={(e) => {
                setFilterBranchId(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">Tất cả chi nhánh</option>
              {branches.map((item) => (
                <option key={item.id} value={String(item.id)}>
                  {item.name}
                </option>
              ))}
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
          <CardTitle>Danh sách khu vực</CardTitle>
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
                <th className="px-2 py-2">Chi nhánh</th>
                <th className="px-2 py-2">Tên</th>
                <th className="px-2 py-2">Địa chỉ</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {pagedAreas.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() => openEditDialog(item, deletedMode !== "active")}
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
                    {branchNameMap.get(item.branch_id) ?? `#${item.branch_id}`}
                  </td>
                  <td className="px-2 py-2">{item.name}</td>
                  <td className="px-2 py-2">{item.address || "-"}</td>
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
                          openEditDialog(item, deletedMode !== "active")
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
              {pagedAreas.length === 0 ? (
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
              Tổng {pagination.total_items} bản ghi
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAreaId ? "Cập nhật khu vực" : "Thêm khu vực"}
            </DialogTitle>
            <DialogDescription>
              {editingAreaId
                ? "Chỉnh sửa thông tin khu vực đã chọn."
                : "Nhập thông tin để tạo khu vực mới."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Chi nhánh</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={dialogReadonly}
              >
                {branches.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tên khu vực</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={dialogReadonly}
              />
            </div>
            <div className="space-y-2">
              <Label>Địa chỉ</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={dialogReadonly}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={() => void saveArea()} disabled={dialogReadonly}>
              {editingAreaId ? "Lưu thay đổi" : "Thêm mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
