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
import { roomTypesApi } from "@/features/room-types/api/room-types.api";
import type { DeletedMode, RoomType } from "@/features/ops/types";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function translatePricingMode(mode: RoomType["pricing_mode"]): string {
  return mode === "FIXED" ? "Giá cố định" : "Giá theo đầu người";
}

function formatVnd(value: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

type RoomTypeFormState = {
  name: string;
  basePrice: string;
  pricingMode: "FIXED" | "PER_PERSON";
  defaultOcc: string;
  maxOcc: string;
};

const DEFAULT_FORM: RoomTypeFormState = {
  name: "",
  basePrice: "0",
  pricingMode: "FIXED",
  defaultOcc: "1",
  maxOcc: "1",
};

export function RoomTypesPage() {
  const [items, setItems] = useState<RoomType[]>([]);
  const [deletedMode, setDeletedMode] = useState<DeletedMode>("active");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogReadonly, setDialogReadonly] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RoomTypeFormState>(DEFAULT_FORM);

  useEffect(() => {
    void loadItems();
  }, [deletedMode]);

  async function loadItems() {
    try {
      const data = await roomTypesApi.list(deletedMode);
      setItems(data);
      setSelectedIds([]);
      setPage(1);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải loại phòng."));
    }
  }

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      return (
        String(item.id).includes(keyword) ||
        item.name.toLowerCase().includes(keyword) ||
        item.pricing_mode.toLowerCase().includes(keyword)
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

  function applyItemToForm(item: RoomType) {
    setForm({
      name: item.name,
      basePrice: item.base_price,
      pricingMode: item.pricing_mode,
      defaultOcc: String(item.default_occupancy),
      maxOcc: String(item.max_occupancy),
    });
  }

  function openCreateDialog() {
    setEditingId(null);
    setDialogReadonly(false);
    setForm(DEFAULT_FORM);
    setIsDialogOpen(true);
  }

  function openDetailDialog(item: RoomType, readonly = false) {
    setEditingId(item.id);
    setDialogReadonly(readonly);
    applyItemToForm(item);
    setIsDialogOpen(true);
  }

  async function saveItem() {
    try {
      if (!form.name.trim()) {
        toast.error("Vui lòng nhập tên loại phòng.");
        return;
      }

      const payload = {
        name: form.name.trim(),
        base_price: form.basePrice,
        pricing_mode: form.pricingMode,
        default_occupancy: Number(form.defaultOcc),
        max_occupancy: Number(form.maxOcc),
      };

      if (editingId) {
        await roomTypesApi.update(editingId, payload);
        toast.success("Cập nhật loại phòng thành công.");
      } else {
        await roomTypesApi.create(payload);
        toast.success("Thêm loại phòng thành công.");
      }
      setIsDialogOpen(false);
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu loại phòng thất bại."));
    }
  }

  async function softDeleteItem(itemId: number) {
    try {
      await roomTypesApi.remove(itemId);
      toast.success("Xóa mềm loại phòng thành công.");
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa loại phòng thất bại."));
    }
  }

  async function bulkDeleteSelected() {
    if (selectedIds.length === 0) return;
    try {
      if (deletedMode === "trash") {
        await Promise.all(selectedIds.map((id) => roomTypesApi.removeHard(id)));
        toast.success("Xóa cứng loại phòng thành công.");
      } else {
        await Promise.all(selectedIds.map((id) => roomTypesApi.remove(id)));
        toast.success("Xóa mềm loại phòng thành công.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa loại phòng thất bại."));
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý loại phòng</h1>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Bộ lọc và thao tác</CardTitle>
          <div className="grid gap-3 md:grid-cols-4">
            <Input
              placeholder="Tìm theo ID, tên loại phòng..."
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
          <CardTitle>Danh sách loại phòng</CardTitle>
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
                <th className="px-2 py-2">Giá cơ bản</th>
                <th className="px-2 py-2">Hình thức tính giá</th>
                <th className="px-2 py-2">Sức chứa (mặc định/tối đa)</th>
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
                  <td className="px-2 py-2">{item.name}</td>
                  <td className="px-2 py-2">{formatVnd(item.base_price)}</td>
                  <td className="px-2 py-2">
                    {translatePricingMode(item.pricing_mode)}
                  </td>
                  <td className="px-2 py-2">
                    {item.default_occupancy}/{item.max_occupancy}
                  </td>
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
                    colSpan={7}
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Chi tiết loại phòng" : "Thêm loại phòng"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Xem/cập nhật thông tin loại phòng."
                : "Nhập thông tin để tạo loại phòng mới."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>Tên</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                disabled={dialogReadonly}
              />
            </div>
            <div className="space-y-2">
              <Label>Giá cơ bản</Label>
              <Input
                value={form.basePrice}
                onChange={(e) =>
                  setForm((p) => ({ ...p, basePrice: e.target.value }))
                }
                disabled={dialogReadonly}
              />
            </div>
            <div className="space-y-2">
              <Label>Hình thức tính giá</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={form.pricingMode}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    pricingMode: e.target.value as "FIXED" | "PER_PERSON",
                  }))
                }
                disabled={dialogReadonly}
              >
                <option value="FIXED">Giá cố định</option>
                <option value="PER_PERSON">Giá theo đầu người</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Sức chứa mặc định</Label>
              <Input
                value={form.defaultOcc}
                onChange={(e) =>
                  setForm((p) => ({ ...p, defaultOcc: e.target.value }))
                }
                disabled={dialogReadonly}
              />
            </div>
            <div className="space-y-2">
              <Label>Sức chứa tối đa</Label>
              <Input
                value={form.maxOcc}
                onChange={(e) =>
                  setForm((p) => ({ ...p, maxOcc: e.target.value }))
                }
                disabled={dialogReadonly}
              />
            </div>
          </div>

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
    </section>
  );
}
