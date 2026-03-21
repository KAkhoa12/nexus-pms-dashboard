import { useEffect, useState } from "react";
import axios from "axios";
import { Eye, Trash2 } from "lucide-react";
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
  serviceFeesApi,
  type ServiceFee,
} from "@/features/service-fees/api/service-fees.api";

type ApiErrorBody = { message?: string };

type BillingCycle = "MONTHLY" | "ONE_TIME" | "CUSTOM_MONTHS";
type ChargeMode = "FIXED" | "USAGE";

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function getBillingCycleLabel(
  cycle: BillingCycle,
  intervalMonths: number | null,
): string {
  if (cycle === "MONTHLY") return "Hàng tháng";
  if (cycle === "ONE_TIME") return "Một lần";
  if (intervalMonths && intervalMonths > 0)
    return `Mỗi ${intervalMonths} tháng`;
  return "Chu kỳ tùy chỉnh";
}

function getChargeModeLabel(mode: ChargeMode): string {
  return mode === "USAGE" ? "Theo mức sử dụng" : "Cố định";
}

function formatVnd(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return `${amount.toLocaleString("vi-VN")} ₫`;
}

export function ServiceFeesPage() {
  const [items, setItems] = useState<ServiceFee[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    items_per_page: 10,
    total_items: 0,
    total_pages: 1,
  });
  const [mode, setMode] = useState<"active" | "trash" | "all">("active");
  const [search, setSearch] = useState("");
  const [billingCycleFilter, setBillingCycleFilter] = useState<
    BillingCycle | "ALL"
  >("ALL");
  const [chargeModeFilter, setChargeModeFilter] = useState<ChargeMode | "ALL">(
    "ALL",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogReadonly, setDialogReadonly] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [cycleIntervalMonths, setCycleIntervalMonths] = useState("1");
  const [chargeMode, setChargeMode] = useState<ChargeMode>("FIXED");
  const [description, setDescription] = useState("");

  useEffect(() => {
    void loadItems();
  }, [mode, search, billingCycleFilter, chargeModeFilter, page, pageSize]);

  async function loadItems() {
    try {
      const data = await serviceFeesApi.list({
        mode,
        page,
        itemsPerPage: pageSize,
        searchKey: search.trim() || undefined,
        billingCycle:
          billingCycleFilter === "ALL" ? undefined : billingCycleFilter,
        chargeMode: chargeModeFilter === "ALL" ? undefined : chargeModeFilter,
      });
      setItems(data.items);
      setPagination(data.pagination);
      setSelectedIds([]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách phí thu."));
    }
  }

  function resetForm() {
    setEditingId(null);
    setDialogReadonly(false);
    setName("");
    setUnit("");
    setPrice("");
    setBillingCycle("MONTHLY");
    setCycleIntervalMonths("1");
    setChargeMode("FIXED");
    setDescription("");
  }

  function openCreate() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEdit(item: ServiceFee, readonly = false) {
    setEditingId(item.id);
    setDialogReadonly(readonly);
    setName(item.name);
    setUnit(item.unit || "");
    setPrice(item.default_price != null ? String(item.default_price) : "");
    setBillingCycle(item.billing_cycle);
    setCycleIntervalMonths(String(item.cycle_interval_months ?? 1));
    setChargeMode(item.charge_mode);
    setDescription(item.description || "");
    setIsDialogOpen(true);
  }

  async function saveItem() {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên phí.");
      return;
    }
    if (
      billingCycle === "CUSTOM_MONTHS" &&
      (!cycleIntervalMonths.trim() || Number(cycleIntervalMonths) < 1)
    ) {
      toast.error("Chu kỳ tùy chỉnh cần số tháng >= 1.");
      return;
    }
    try {
      const payload = {
        name: name.trim(),
        unit: unit.trim() || null,
        default_price: price.trim() ? Number(price) : null,
        billing_cycle: billingCycle,
        cycle_interval_months:
          billingCycle === "CUSTOM_MONTHS"
            ? Number(cycleIntervalMonths)
            : billingCycle === "MONTHLY"
              ? 1
              : null,
        charge_mode: chargeMode,
        description: description.trim() || null,
      };
      if (editingId) {
        await serviceFeesApi.update(editingId, payload);
        toast.success("Cập nhật phí thu thành công.");
      } else {
        await serviceFeesApi.create(payload);
        toast.success("Thêm phí thu thành công.");
      }
      setIsDialogOpen(false);
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu phí thu thất bại."));
    }
  }

  async function removeOne(id: number) {
    try {
      await serviceFeesApi.remove(id);
      toast.success("Xóa mềm phí thu thành công.");
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa phí thu thất bại."));
    }
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    try {
      if (mode === "trash") {
        await Promise.all(
          selectedIds.map((id) => serviceFeesApi.removeHard(id)),
        );
        toast.success("Xóa vĩnh viễn phí thu thành công.");
      } else {
        await Promise.all(selectedIds.map((id) => serviceFeesApi.remove(id)));
        toast.success("Xóa mềm phí thu thành công.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa phí thu thất bại."));
    }
  }

  const allOnPageSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý phí dịch vụ</h1>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Bộ lọc và thao tác</CardTitle>
          <div className="grid gap-3 md:grid-cols-7">
            <Input
              placeholder="Tìm theo ID, tên, đơn vị..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={billingCycleFilter}
              onChange={(event) => {
                setBillingCycleFilter(
                  event.target.value as BillingCycle | "ALL",
                );
                setPage(1);
              }}
            >
              <option value="ALL">Chu kỳ: Tất cả</option>
              <option value="MONTHLY">Hàng tháng</option>
              <option value="ONE_TIME">Một lần</option>
              <option value="CUSTOM_MONTHS">Chu kỳ tùy chỉnh</option>
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={chargeModeFilter}
              onChange={(event) => {
                setChargeModeFilter(event.target.value as ChargeMode | "ALL");
                setPage(1);
              }}
            >
              <option value="ALL">Kiểu tính: Tất cả</option>
              <option value="FIXED">Cố định</option>
              <option value="USAGE">Theo sử dụng</option>
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as "active" | "trash" | "all");
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
            <Button onClick={openCreate}>Thêm phí dịch vụ</Button>
            <Button
              variant={mode === "trash" ? "destructive" : "outline"}
              disabled={!selectedIds.length}
              onClick={() => void bulkDelete()}
            >
              {mode === "trash" ? "Xóa vĩnh viễn đã chọn" : "Xóa đã chọn"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách phí dịch vụ</CardTitle>
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
                        setSelectedIds(
                          Array.from(
                            new Set([
                              ...selectedIds,
                              ...items.map((item) => item.id),
                            ]),
                          ),
                        );
                      } else {
                        setSelectedIds(
                          selectedIds.filter(
                            (id) => !items.some((item) => item.id === id),
                          ),
                        );
                      }
                    }}
                  />
                </th>
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Tên phí</th>
                <th className="px-2 py-2">Đơn vị</th>
                <th className="px-2 py-2">Đơn giá mặc định</th>
                <th className="px-2 py-2">Chu kỳ thu</th>
                <th className="px-2 py-2">Kiểu tính</th>
                <th className="px-2 py-2">Mô tả</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() => openEdit(item, mode !== "active")}
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
                          setSelectedIds([...selectedIds, item.id]);
                        } else {
                          setSelectedIds(
                            selectedIds.filter((id) => id !== item.id),
                          );
                        }
                      }}
                    />
                  </td>
                  <td className="px-2 py-2 font-medium">{item.id}</td>
                  <td className="px-2 py-2">{item.name}</td>
                  <td className="px-2 py-2">{item.unit || "-"}</td>
                  <td className="px-2 py-2">{formatVnd(item.default_price)}</td>
                  <td className="px-2 py-2">
                    {getBillingCycleLabel(
                      item.billing_cycle,
                      item.cycle_interval_months,
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {getChargeModeLabel(item.charge_mode)}
                  </td>
                  <td className="px-2 py-2">{item.description || "-"}</td>
                  <td
                    className="px-2 py-2 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => openEdit(item, mode !== "active")}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        disabled={mode !== "active"}
                        onClick={() => void removeOne(item.id)}
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
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    Không có dữ liệu phí dịch vụ.
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Chi tiết phí dịch vụ" : "Thêm phí dịch vụ"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tên phí</label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={dialogReadonly}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Đơn vị</label>
              <Input
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                disabled={dialogReadonly}
                placeholder="kWh, m3, tháng, xe..."
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Đơn giá mặc định</label>
              <Input
                type="number"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                disabled={dialogReadonly}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Chu kỳ thu phí</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={billingCycle}
                onChange={(event) =>
                  setBillingCycle(event.target.value as BillingCycle)
                }
                disabled={dialogReadonly}
              >
                <option value="MONTHLY">Hàng tháng</option>
                <option value="ONE_TIME">Một lần</option>
                <option value="CUSTOM_MONTHS">Chu kỳ tùy chỉnh</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Kiểu tính phí</label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3"
                value={chargeMode}
                onChange={(event) =>
                  setChargeMode(event.target.value as ChargeMode)
                }
                disabled={dialogReadonly}
              >
                <option value="FIXED">Cố định</option>
                <option value="USAGE">Theo sử dụng</option>
              </select>
            </div>
            {billingCycle === "CUSTOM_MONTHS" ? (
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Mỗi bao nhiêu tháng
                </label>
                <Input
                  type="number"
                  min={1}
                  value={cycleIntervalMonths}
                  onChange={(event) =>
                    setCycleIntervalMonths(event.target.value)
                  }
                  disabled={dialogReadonly}
                />
              </div>
            ) : null}
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Mô tả</label>
              <textarea
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={dialogReadonly}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Đóng
            </Button>
            {!dialogReadonly ? (
              <Button onClick={() => void saveItem()}>Lưu</Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
