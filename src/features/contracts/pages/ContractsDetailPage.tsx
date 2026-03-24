import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowLeft, Eye } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  contractsApi,
  type LeaseDetail,
  type LeaseInstallment,
} from "@/features/contracts/api/contracts.api";

type ApiErrorBody = { message?: string };

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

export function ContractsDetailPage() {
  const navigate = useNavigate();
  const params = useParams<{ leaseId?: string }>();
  const leaseId = Number(params.leaseId || "0");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<LeaseDetail | null>(null);

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

  const installmentTotal = useMemo(() => {
    if (!detail) return 0;
    return detail.installments.reduce((sum, installment) => {
      const amount = Number(installment.total_amount || "0");
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
  }, [detail]);

  function goInstallmentEdit(invoiceId: number) {
    navigate(`/dashboard/contracts/${leaseId}/installments/${invoiceId}/edit`);
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
        <CardContent className="grid gap-3 md:grid-cols-4">
          {loading || !detail ? (
            <p className="text-sm text-muted-foreground md:col-span-4">
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
        <CardContent className="space-y-3 overflow-x-auto">
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            Tổng tiền tất cả kỳ: <strong>{toVnd(installmentTotal)}</strong>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">Kỳ</th>
                <th className="px-2 py-2">Tháng</th>
                <th className="px-2 py-2">Hạn thanh toán</th>
                <th className="px-2 py-2">Tổng tiền</th>
                <th className="px-2 py-2">Đã thanh toán</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2 text-right">Chi tiết</th>
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
                <tr
                  key={installment.id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() => goInstallmentEdit(installment.id)}
                >
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
                      onClick={(event) => {
                        event.stopPropagation();
                        goInstallmentEdit(installment.id);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
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
