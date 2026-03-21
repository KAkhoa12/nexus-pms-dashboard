import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TEMPLATE_VARIABLES } from "@/features/form-templates/editor/constants";
import { invoicesApi } from "@/features/invoices/api/invoices.api";
import type { Invoice } from "@/features/ops/types";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function InvoicesPage() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const [form, setForm] = useState({
    branch_id: "1",
    room_id: "1",
    renter_id: "1",
    period_month: "",
    due_date: "",
    total_amount: "0",
    paid_amount: "0",
    status: "UNPAID" as "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE",
    content: "",
    content_html: "",
  });

  useEffect(() => {
    void loadItems();
  }, []);

  async function loadItems() {
    try {
      const data = await invoicesApi.list("active");
      setItems(data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải hóa đơn."));
    }
  }

  async function saveItem() {
    try {
      const payload = {
        branch_id: Number(form.branch_id),
        room_id: Number(form.room_id),
        renter_id: Number(form.renter_id),
        period_month: form.period_month,
        due_date: form.due_date,
        total_amount: form.total_amount,
        paid_amount: form.paid_amount,
        status: form.status,
        content: form.content,
        content_html: form.content_html,
        items: [] as Array<{
          description: string;
          quantity: string;
          unit_price: string;
          amount: string;
        }>,
      };
      if (selected) {
        await invoicesApi.update(selected.id, payload);
        toast.success("Cập nhật hóa đơn thành công.");
      } else {
        await invoicesApi.create(payload);
        toast.success("Thêm hóa đơn thành công.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu hóa đơn thất bại."));
    }
  }

  async function deleteItem() {
    if (!selected) return;
    try {
      await invoicesApi.remove(selected.id);
      setSelected(null);
      setForm({
        branch_id: "1",
        room_id: "1",
        renter_id: "1",
        period_month: "",
        due_date: "",
        total_amount: "0",
        paid_amount: "0",
        status: "UNPAID",
        content: "",
        content_html: "",
      });
      toast.success("Xóa mềm hóa đơn thành công.");
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa hóa đơn thất bại."));
    }
  }

  function insertVariableToken(token: string) {
    const textarea = contentRef.current;
    if (!textarea) {
      setForm((prev) => ({ ...prev, content: `${prev.content}${token}` }));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = form.content;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    setForm((prev) => ({ ...prev, content: next }));

    window.requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + token.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý hóa đơn</h1>
      <Card>
        <CardHeader>
          <CardTitle>Thông tin hóa đơn</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Branch ID</Label>
            <Input
              value={form.branch_id}
              onChange={(e) =>
                setForm((p) => ({ ...p, branch_id: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Room ID</Label>
            <Input
              value={form.room_id}
              onChange={(e) =>
                setForm((p) => ({ ...p, room_id: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Renter ID</Label>
            <Input
              value={form.renter_id}
              onChange={(e) =>
                setForm((p) => ({ ...p, renter_id: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Kỳ tháng</Label>
            <Input
              value={form.period_month}
              onChange={(e) =>
                setForm((p) => ({ ...p, period_month: e.target.value }))
              }
              placeholder="2026-03"
            />
          </div>
          <div className="space-y-2">
            <Label>Hạn thanh toán (ISO)</Label>
            <Input
              value={form.due_date}
              onChange={(e) =>
                setForm((p) => ({ ...p, due_date: e.target.value }))
              }
              placeholder="2026-03-31T23:59:00+07:00"
            />
          </div>
          <div className="space-y-2">
            <Label>Trạng thái</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  status: e.target.value as
                    | "UNPAID"
                    | "PARTIAL"
                    | "PAID"
                    | "OVERDUE",
                }))
              }
            >
              <option value="UNPAID">UNPAID</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="PAID">PAID</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Tổng tiền</Label>
            <Input
              value={form.total_amount}
              onChange={(e) =>
                setForm((p) => ({ ...p, total_amount: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Đã thanh toán</Label>
            <Input
              value={form.paid_amount}
              onChange={(e) =>
                setForm((p) => ({ ...p, paid_amount: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Nội dung hóa đơn / biểu mẫu</Label>
            <textarea
              ref={contentRef}
              className="min-h-[180px] w-full rounded-md border bg-background p-3 text-sm"
              value={form.content}
              onChange={(e) =>
                setForm((p) => ({ ...p, content: e.target.value }))
              }
              placeholder="Nhập nội dung hóa đơn. Có thể chèn biến dữ liệu bên dưới..."
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {TEMPLATE_VARIABLES.map((variable) => (
                <Button
                  key={variable.token}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertVariableToken(variable.token)}
                >
                  {variable.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label>Nội dung HTML theo mẫu</Label>
            <textarea
              className="min-h-[140px] w-full rounded-md border bg-background p-3 text-sm"
              value={form.content_html}
              onChange={(e) =>
                setForm((p) => ({ ...p, content_html: e.target.value }))
              }
              placeholder="<div>...</div>"
            />
          </div>
          <div className="md:col-span-3 flex gap-2">
            <Button onClick={() => void saveItem()}>
              {selected ? "Cập nhật" : "Thêm mới"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void deleteItem()}
              disabled={!selected}
            >
              Xóa mềm
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách hóa đơn</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Kỳ</th>
                <th className="px-2 py-2">Room/Renter</th>
                <th className="px-2 py-2">Tổng tiền</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Nội dung</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() => {
                    setSelected(item);
                    setForm({
                      branch_id: String(item.branch_id),
                      room_id: String(item.room_id),
                      renter_id: String(item.renter_id),
                      period_month: item.period_month,
                      due_date: item.due_date,
                      total_amount: item.total_amount,
                      paid_amount: item.paid_amount,
                      status: item.status,
                      content: item.content || "",
                      content_html: item.content_html || "",
                    });
                  }}
                >
                  <td className="px-2 py-2">{item.id}</td>
                  <td className="px-2 py-2">{item.period_month}</td>
                  <td className="px-2 py-2">
                    {item.room_id}/{item.renter_id}
                  </td>
                  <td className="px-2 py-2">{item.total_amount}</td>
                  <td className="px-2 py-2">{item.status}</td>
                  <td className="max-w-[320px] truncate px-2 py-2">
                    {item.content}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
