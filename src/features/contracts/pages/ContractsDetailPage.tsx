import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowLeft, PencilLine, Plus, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Label } from "@/components/ui/label";
import {
  contractsApi,
  type LeaseDetail,
  type LeaseInstallment,
} from "@/features/contracts/api/contracts.api";

type ApiErrorBody = { message?: string };
type EditableItem = {
  description: string;
  quantity: string;
  unit_price: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function statusLabel(status: LeaseInstallment["status"]): string {
  if (status === "PAID") return "Đã thanh toán";
  if (status === "PARTIAL") return "Thanh toán một phần";
  if (status === "OVERDUE") return "Quá hạn";
  return "Chưa thanh toán";
}

function leaseStatusLabel(status: LeaseDetail["lease"]["status"]): string {
  if (status === "ACTIVE") return "Hiệu lực";
  if (status === "ENDED") return "Đã kết thúc";
  return "Đã hủy";
}

function toVnd(value: string | number): string {
  const numberValue =
    typeof value === "number"
      ? value
      : Number(String(value).replaceAll(",", "").trim() || "0");
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
}

function toDateTimeLocalValue(raw: string): string {
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset() * 60_000;
  const local = new Date(parsed.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

function toIsoOrUndefined(raw: string): string | undefined {
  const normalized = raw.trim();
  if (!normalized) return undefined;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function ContractsDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ leaseId?: string }>();
  const leaseId = Number(params.leaseId || "0");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<LeaseDetail | null>(null);

  const [editingInstallment, setEditingInstallment] =
    useState<LeaseInstallment | null>(null);
  const [savingInstallment, setSavingInstallment] = useState(false);
  const [editDueDate, setEditDueDate] = useState("");
  const [editReminderAt, setEditReminderAt] = useState("");
  const [editStatus, setEditStatus] =
    useState<LeaseInstallment["status"]>("UNPAID");
  const [editContent, setEditContent] = useState("");
  const [editContentHtml, setEditContentHtml] = useState("");
  const [editItems, setEditItems] = useState<EditableItem[]>([]);

  const loadDetail = useCallback(async () => {
    if (!leaseId || Number.isNaN(leaseId)) return;
    setLoading(true);
    try {
      const response = await contractsApi.getDetail(leaseId);
      setDetail(response);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể tải chi tiết hợp đồng thuê."),
      );
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const totalInstallmentAmount = useMemo(() => {
    return editItems.reduce((sum, item) => {
      const quantity = Number(item.quantity || "0");
      const unitPrice = Number(item.unit_price || "0");
      if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) return sum;
      return sum + quantity * unitPrice;
    }, 0);
  }, [editItems]);

  function openInstallmentEditor(installment: LeaseInstallment) {
    setEditingInstallment(installment);
    setEditDueDate(toDateTimeLocalValue(installment.due_date));
    setEditReminderAt(toDateTimeLocalValue(installment.reminder_at || ""));
    setEditStatus(installment.status);
    setEditContent(installment.content || "");
    setEditContentHtml(installment.content_html || "");
    setEditItems(
      installment.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    );
  }

  function closeInstallmentEditor() {
    setEditingInstallment(null);
    setEditDueDate("");
    setEditReminderAt("");
    setEditStatus("UNPAID");
    setEditContent("");
    setEditContentHtml("");
    setEditItems([]);
  }

  function addEditableItemRow() {
    setEditItems((prev) => [
      ...prev,
      { description: "", quantity: "1", unit_price: "0" },
    ]);
  }

  function removeEditableItemRow(index: number) {
    setEditItems((prev) => prev.filter((_, idx) => idx !== index));
  }

  function updateEditableItem(
    index: number,
    field: keyof EditableItem,
    value: string,
  ) {
    setEditItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  async function saveInstallmentChanges() {
    if (!detail || !editingInstallment) return;
    const payloadItems = editItems
      .map((item) => ({
        description: item.description.trim(),
        quantity: item.quantity.trim(),
        unit_price: item.unit_price.trim(),
      }))
      .filter(
        (item) =>
          item.description.length > 0 &&
          Number(item.quantity) > 0 &&
          Number.isFinite(Number(item.unit_price)),
      );

    if (payloadItems.length === 0) {
      toast.error("Vui lòng nhập ít nhất 1 dòng phí hợp lệ.");
      return;
    }

    setSavingInstallment(true);
    try {
      await contractsApi.updateInstallment(
        detail.lease.id,
        editingInstallment.id,
        {
          due_date: toIsoOrUndefined(editDueDate),
          reminder_at: toIsoOrUndefined(editReminderAt) ?? null,
          status: editStatus,
          content: editContent,
          content_html: editContentHtml,
          items: payloadItems,
        },
      );
      toast.success("Đã cập nhật kỳ thanh toán.");
      closeInstallmentEditor();
      await loadDetail();
    } catch (error) {
      toast.error(getErrorMessage(error, "Cập nhật kỳ thanh toán thất bại."));
    } finally {
      setSavingInstallment(false);
    }
  }

  if (!leaseId || Number.isNaN(leaseId)) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-destructive">ID hợp đồng không hợp lệ.</p>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard/contracts")}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Quay lại danh sách hợp đồng
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/dashboard/contracts")}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Danh sách hợp đồng
          </Button>
          <h1 className="text-2xl font-semibold">
            Chi tiết hợp đồng #{leaseId}
          </h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin hợp đồng</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {loading || !detail ? (
            <p className="text-sm text-muted-foreground md:col-span-3">
              Đang tải thông tin hợp đồng...
            </p>
          ) : (
            <>
              <div>
                <p className="text-xs text-muted-foreground">Khách thuê</p>
                <p className="font-medium">
                  {detail.renter
                    ? `${detail.renter.full_name} - ${detail.renter.phone}`
                    : `#${detail.lease.renter_id}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phòng</p>
                <p className="font-medium">
                  {detail.room
                    ? `${detail.room.code} (#${detail.room.id})`
                    : `#${detail.lease.room_id}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Trạng thái hợp đồng
                </p>
                <p className="font-medium">
                  {leaseStatusLabel(detail.lease.status)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ngày bắt đầu</p>
                <p className="font-medium">
                  {new Date(detail.lease.start_date).toLocaleDateString(
                    "vi-VN",
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ngày kết thúc</p>
                <p className="font-medium">
                  {detail.lease.end_date
                    ? new Date(detail.lease.end_date).toLocaleDateString(
                        "vi-VN",
                      )
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Giá thuê</p>
                <p className="font-medium">{toVnd(detail.lease.rent_price)}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Các kỳ thanh toán theo hợp đồng</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">Kỳ</th>
                <th className="px-2 py-2">Tháng</th>
                <th className="px-2 py-2">Hạn thanh toán</th>
                <th className="px-2 py-2">Tổng tiền</th>
                <th className="px-2 py-2">Đã thanh toán</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!loading && detail && detail.installments.length === 0 ? (
                <tr>
                  <td
                    className="px-2 py-4 text-center text-muted-foreground"
                    colSpan={7}
                  >
                    Hợp đồng này chưa có kỳ thanh toán.
                  </td>
                </tr>
              ) : null}
              {detail?.installments.map((installment) => (
                <tr key={installment.id} className="border-b hover:bg-muted/30">
                  <td className="px-2 py-2">
                    {installment.installment_no || "-"}
                    {installment.installment_total
                      ? `/${installment.installment_total}`
                      : ""}
                  </td>
                  <td className="px-2 py-2">{installment.period_month}</td>
                  <td className="px-2 py-2">
                    {new Date(installment.due_date).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-2 py-2">
                    {toVnd(installment.total_amount)}
                  </td>
                  <td className="px-2 py-2">
                    {toVnd(installment.paid_amount)}
                  </td>
                  <td className="px-2 py-2">
                    {statusLabel(installment.status)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => openInstallmentEditor(installment)}
                    >
                      <PencilLine className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog
        open={!!editingInstallment}
        onOpenChange={(open) => {
          if (!open) closeInstallmentEditor();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Điều chỉnh kỳ thanh toán{" "}
              {editingInstallment?.installment_no
                ? `#${editingInstallment.installment_no}`
                : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Hạn thanh toán</Label>
              <Input
                type="datetime-local"
                value={editDueDate}
                onChange={(event) => setEditDueDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nhắc nhở</Label>
              <Input
                type="datetime-local"
                value={editReminderAt}
                onChange={(event) => setEditReminderAt(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Trạng thái</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editStatus}
                onChange={(event) =>
                  setEditStatus(
                    event.target.value as LeaseInstallment["status"],
                  )
                }
              >
                <option value="UNPAID">Chưa thanh toán</option>
                <option value="PARTIAL">Thanh toán một phần</option>
                <option value="PAID">Đã thanh toán</option>
                <option value="OVERDUE">Quá hạn</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Danh sách dòng phí kỳ này</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEditableItemRow}
              >
                <Plus className="mr-1 h-4 w-4" />
                Thêm dòng phí
              </Button>
            </div>
            <div className="space-y-2">
              {editItems.map((item, index) => {
                const rowAmount =
                  Number(item.quantity || "0") * Number(item.unit_price || "0");
                return (
                  <div
                    key={`editable-item-${index}`}
                    className="grid gap-2 rounded-md border p-2 md:grid-cols-12"
                  >
                    <Input
                      className="md:col-span-5"
                      placeholder="Mô tả phí"
                      value={item.description}
                      onChange={(event) =>
                        updateEditableItem(
                          index,
                          "description",
                          event.target.value,
                        )
                      }
                    />
                    <Input
                      className="md:col-span-2"
                      placeholder="SL"
                      value={item.quantity}
                      onChange={(event) =>
                        updateEditableItem(
                          index,
                          "quantity",
                          event.target.value,
                        )
                      }
                    />
                    <Input
                      className="md:col-span-3"
                      placeholder="Đơn giá"
                      value={item.unit_price}
                      onChange={(event) =>
                        updateEditableItem(
                          index,
                          "unit_price",
                          event.target.value,
                        )
                      }
                    />
                    <div className="md:col-span-1 flex items-center text-sm font-medium">
                      {toVnd(rowAmount)}
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        onClick={() => removeEditableItemRow(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-right text-sm font-semibold">
              Tổng kỳ sau điều chỉnh: {toVnd(totalInstallmentAmount)}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Nội dung</Label>
            <textarea
              className="min-h-[90px] w-full rounded-md border border-input bg-background p-2 text-sm"
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nội dung HTML</Label>
            <textarea
              className="min-h-[110px] w-full rounded-md border border-input bg-background p-2 text-sm"
              value={editContentHtml}
              onChange={(event) => setEditContentHtml(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeInstallmentEditor}
            >
              Hủy
            </Button>
            <Button
              type="button"
              disabled={savingInstallment}
              onClick={() => void saveInstallmentChanges()}
            >
              {savingInstallment ? "Đang lưu..." : "Lưu thay đổi kỳ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
