import { useEffect, useState } from "react";
import axios from "axios";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PaginationMeta } from "@/features/auth/types";
import { customerAppointmentsApi, type CustomerAppointment } from "@/features/customer-appointments/api/customer-appointments.api";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function toInputDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromInputDateTime(value: string): string {
  const d = new Date(value);
  return d.toISOString();
}

export function CustomerAppointmentsPage() {
  const [items, setItems] = useState<CustomerAppointment[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    items_per_page: 10,
    total_items: 0,
    total_pages: 1,
  });
  const [mode, setMode] = useState<"active" | "trash" | "all">("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogReadonly, setDialogReadonly] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("SCHEDULED");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    void loadItems();
  }, [mode, search, page, pageSize]);

  async function loadItems() {
    try {
      const data = await customerAppointmentsApi.list({
        mode,
        page,
        itemsPerPage: pageSize,
        searchKey: search.trim() || undefined,
      });
      setItems(data.items);
      setPagination(data.pagination);
      setSelectedIds([]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách khách hẹn."));
    }
  }

  function resetForm() {
    setEditingId(null);
    setDialogReadonly(false);
    setContactName("");
    setPhone("");
    setEmail("");
    setSource("");
    setStatus("SCHEDULED");
    setStartAt("");
    setEndAt("");
    setNote("");
  }

  function openCreate() {
    resetForm();
    setIsDialogOpen(true);
  }

  function openEdit(item: CustomerAppointment, readonly = false) {
    setEditingId(item.id);
    setDialogReadonly(readonly);
    setContactName(item.contact_name);
    setPhone(item.phone);
    setEmail(item.email || "");
    setSource(item.source || "");
    setStatus(item.status || "SCHEDULED");
    setStartAt(toInputDateTime(item.start_at));
    setEndAt(toInputDateTime(item.end_at));
    setNote(item.note || "");
    setIsDialogOpen(true);
  }

  async function saveItem() {
    if (!contactName.trim() || !phone.trim() || !startAt || !endAt) {
      toast.error("Vui lòng nhập đủ tên liên hệ, SĐT, giờ bắt đầu và kết thúc.");
      return;
    }
    try {
      const payload = {
        contact_name: contactName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        source: source.trim() || null,
        status: status.trim().toUpperCase(),
        start_at: fromInputDateTime(startAt),
        end_at: fromInputDateTime(endAt),
        note: note.trim() || null,
      };
      if (editingId) {
        await customerAppointmentsApi.update(editingId, payload);
        toast.success("Cập nhật khách hẹn thành công.");
      } else {
        await customerAppointmentsApi.create(payload);
        toast.success("Thêm khách hẹn thành công.");
      }
      setIsDialogOpen(false);
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu khách hẹn thất bại."));
    }
  }

  async function removeOne(id: number) {
    try {
      await customerAppointmentsApi.remove(id);
      toast.success("Xóa mềm khách hẹn thành công.");
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa khách hẹn thất bại."));
    }
  }

  async function bulkDelete() {
    if (!selectedIds.length) return;
    try {
      if (mode === "trash") {
        await Promise.all(selectedIds.map((id) => customerAppointmentsApi.removeHard(id)));
        toast.success("Xóa vĩnh viễn khách hẹn thành công.");
      } else {
        await Promise.all(selectedIds.map((id) => customerAppointmentsApi.remove(id)));
        toast.success("Xóa mềm khách hẹn thành công.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa khách hẹn thất bại."));
    }
  }

  const allOnPageSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Khách hẹn</h1>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>Bộ lọc và thao tác</CardTitle>
          <div className="grid gap-3 md:grid-cols-5">
            <Input
              placeholder="Tìm theo tên, SĐT, email, mô tả..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
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
            <Button onClick={openCreate}>Thêm khách hẹn</Button>
            <Button variant={mode === "trash" ? "destructive" : "outline"} disabled={!selectedIds.length} onClick={() => void bulkDelete()}>
              {mode === "trash" ? "Xóa vĩnh viễn đã chọn" : "Xóa đã chọn"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách khách hẹn</CardTitle>
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
                        setSelectedIds(Array.from(new Set([...selectedIds, ...items.map((item) => item.id)])));
                      } else {
                        setSelectedIds(selectedIds.filter((id) => !items.some((item) => item.id === id)));
                      }
                    }}
                  />
                </th>
                <th className="px-2 py-2">Liên hệ</th>
                <th className="px-2 py-2">SĐT</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Thời gian</th>
                <th className="px-2 py-2">Nguồn</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="cursor-pointer border-b hover:bg-muted/40" onClick={() => openEdit(item, mode !== "active")}>
                  <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(item.id)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedIds([...selectedIds, item.id]);
                        } else {
                          setSelectedIds(selectedIds.filter((id) => id !== item.id));
                        }
                      }}
                    />
                  </td>
                  <td className="px-2 py-2">{item.contact_name}</td>
                  <td className="px-2 py-2">{item.phone}</td>
                  <td className="px-2 py-2">{item.email || "-"}</td>
                  <td className="px-2 py-2">{new Date(item.start_at).toLocaleString("vi-VN")} - {new Date(item.end_at).toLocaleString("vi-VN")}</td>
                  <td className="px-2 py-2">{item.source || "-"}</td>
                  <td className="px-2 py-2">{item.status}</td>
                  <td className="px-2 py-2 text-right" onClick={(event) => event.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="icon" variant="outline" onClick={() => openEdit(item, mode !== "active")}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button type="button" size="icon" variant="destructive" disabled={mode !== "active"} onClick={() => void removeOne(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center text-muted-foreground">
                    Không có dữ liệu khách hẹn.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-sm">
            <p className="text-muted-foreground">
              Trang {pagination.page}/{Math.max(1, pagination.total_pages)} - Tổng {pagination.total_items} bản ghi
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))}>
                Trước
              </Button>
              <Button variant="outline" size="sm" disabled={page >= Math.max(1, pagination.total_pages)} onClick={() => setPage((previous) => previous + 1)}>
                Sau
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Chi tiết khách hẹn" : "Thêm khách hẹn"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tên liên hệ</label>
              <Input value={contactName} onChange={(event) => setContactName(event.target.value)} disabled={dialogReadonly} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Số điện thoại</label>
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} disabled={dialogReadonly} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} disabled={dialogReadonly} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nguồn</label>
              <Input value={source} onChange={(event) => setSource(event.target.value)} disabled={dialogReadonly} placeholder="Facebook, Zalo, Giới thiệu..." />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Đến từ mấy giờ</label>
              <Input type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} disabled={dialogReadonly} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Đến đến mấy giờ</label>
              <Input type="datetime-local" value={endAt} onChange={(event) => setEndAt(event.target.value)} disabled={dialogReadonly} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Trạng thái</label>
              <Input value={status} onChange={(event) => setStatus(event.target.value)} disabled={dialogReadonly} placeholder="SCHEDULED / COMPLETED / CANCELED" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Mô tả</label>
              <textarea
                className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                disabled={dialogReadonly}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Đóng</Button>
            {!dialogReadonly ? <Button onClick={() => void saveItem()}>Lưu</Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
