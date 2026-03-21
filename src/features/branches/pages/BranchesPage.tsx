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
import { branchesApi } from "@/features/branches/api/branches.api";
import type { Branch, DeletedMode } from "@/features/ops/types";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function BranchesPage() {
  const [items, setItems] = useState<Branch[]>([]);
  const [deletedMode, setDeletedMode] = useState<DeletedMode>("active");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogReadonly, setDialogReadonly] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    void loadItems();
  }, [deletedMode]);

  async function loadItems() {
    try {
      const data = await branchesApi.list(deletedMode);
      setItems(data);
      setSelectedIds([]);
      setPage(1);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách chi nhánh."));
    }
  }

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
        return (
          String(item.id).includes(keyword) ||
          item.name.toLowerCase().includes(keyword)
        );
      });
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const allOnPageSelected =
    paged.length > 0 && paged.every((item) => selectedIds.includes(item.id));

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
    setName("");
    setIsDialogOpen(true);
  }

  function openEditDialog(item: Branch, readonly = false) {
    setEditingId(item.id);
    setDialogReadonly(readonly);
    setName(item.name);
    setIsDialogOpen(true);
  }

  async function saveItem() {
    try {
      if (!name.trim()) {
        toast.error("Vui lòng nhập tên chi nhánh.");
        return;
      }
      if (editingId) {
        await branchesApi.update(editingId, { name: name.trim() });
        toast.success("Cập nhật chi nhánh thành công.");
      } else {
        await branchesApi.create({ name: name.trim() });
        toast.success("Thêm chi nhánh thành công.");
      }
      setIsDialogOpen(false);
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu chi nhánh thất bại."));
    }
  }

  async function bulkDeleteSelected() {
    if (selectedIds.length === 0) return;
    try {
      if (deletedMode === "trash") {
        await Promise.all(selectedIds.map((id) => branchesApi.removeHard(id)));
        toast.success("Xóa cứng chi nhánh thành công.");
      } else {
        await Promise.all(selectedIds.map((id) => branchesApi.remove(id)));
        toast.success("Xóa mềm chi nhánh thành công.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa chi nhánh thất bại."));
    }
  }

  async function softDeleteItem(branchId: number) {
    try {
      await branchesApi.remove(branchId);
      toast.success("Xóa mềm chi nhánh thành công.");
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa chi nhánh thất bại."));
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý chi nhánh</h1>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Bộ lọc và thao tác</CardTitle>
          <div className="grid gap-3 md:grid-cols-4">
              <Input
                placeholder="Tìm theo ID, tên chi nhánh..."
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
          <CardTitle>Danh sách chi nhánh</CardTitle>
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
                <th className="px-2 py-2">Tên</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() => {
                    openEditDialog(item, deletedMode !== "active");
                  }}
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
                  <td className="px-2 py-2">{item.name}</td>
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
              {paged.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Cập nhật chi nhánh" : "Thêm chi nhánh"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Chỉnh sửa thông tin chi nhánh đã chọn."
                : "Nhập thông tin để tạo chi nhánh mới."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Tên chi nhánh</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={dialogReadonly}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={() => void saveItem()} disabled={dialogReadonly}>
              {editingId ? "Lưu thay đổi" : "Thêm mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
