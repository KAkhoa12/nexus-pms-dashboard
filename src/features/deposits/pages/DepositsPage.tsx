import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PaginationMeta } from "@/features/auth/types";
import { depositsApi } from "@/features/deposits/api/deposits.api";
import type { DeletedMode, Deposit } from "@/features/ops/types";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function renderMethod(method: Deposit["method"]): string {
  if (method === "CASH") return "Tiền mặt";
  if (method === "BANK") return "Chuyển khoản";
  return "QR";
}

function renderStatus(status: Deposit["status"]): string {
  if (status === "HELD") return "Đang giữ cọc";
  if (status === "REFUNDED") return "Đã hoàn cọc";
  return "Mất cọc";
}

export function DepositsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Deposit[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    items_per_page: 10,
    total_items: 0,
    total_pages: 1,
  });
  const [deletedMode, setDeletedMode] = useState<DeletedMode>("active");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [roomIdFilter, setRoomIdFilter] = useState("");
  const [leaseIdFilter, setLeaseIdFilter] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadItems();
  }, [deletedMode, page, pageSize, roomIdFilter, leaseIdFilter]);

  async function loadItems() {
    setLoading(true);
    try {
      const data = await depositsApi.list({
        mode: deletedMode,
        page,
        itemsPerPage: pageSize,
        roomId: roomIdFilter.trim() ? Number(roomIdFilter) : undefined,
        leaseId: leaseIdFilter.trim() ? Number(leaseIdFilter) : undefined,
      });
      setItems(data.items);
      setPagination(data.pagination);
      if (
        data.pagination.total_pages > 0 &&
        page > data.pagination.total_pages
      ) {
        setPage(data.pagination.total_pages);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách đặt cọc."));
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(id: number) {
    try {
      if (deletedMode === "trash") {
        await depositsApi.removeHard(id);
        toast.success("Xóa cứng phiếu đặt cọc thành công.");
      } else {
        await depositsApi.remove(id);
        toast.success("Xóa mềm phiếu đặt cọc thành công.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa phiếu đặt cọc thất bại."));
    }
  }

  const totalPages = Math.max(1, pagination.total_pages);
  const safePage = Math.min(page, totalPages);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý đặt cọc</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Input
            placeholder="Lọc theo Room ID"
            value={roomIdFilter}
            onChange={(e) => {
              setRoomIdFilter(e.target.value);
              setPage(1);
            }}
          />
          <Input
            placeholder="Lọc theo Lease ID"
            value={leaseIdFilter}
            onChange={(e) => {
              setLeaseIdFilter(e.target.value);
              setPage(1);
            }}
          />
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={deletedMode}
            onChange={(e) => {
              setDeletedMode(e.target.value as DeletedMode);
              setPage(1);
            }}
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
          <Button variant="outline" onClick={() => void loadItems()}>
            Tải lại dữ liệu
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách phiếu đặt cọc</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Room/Lease</th>
                <th className="px-2 py-2">Renter</th>
                <th className="px-2 py-2">Số tiền</th>
                <th className="px-2 py-2">Phương thức</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Ngày cọc</th>
                <th className="px-2 py-2">Mẫu HTML</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() => navigate(`/dashboard/deposits/${item.id}`)}
                >
                  <td className="px-2 py-2">{item.id}</td>
                  <td className="px-2 py-2">
                    {item.room_id}/{item.lease_id ?? "-"}
                  </td>
                  <td className="px-2 py-2">{item.renter_id ?? "-"}</td>
                  <td className="px-2 py-2">{item.amount}</td>
                  <td className="px-2 py-2">{renderMethod(item.method)}</td>
                  <td className="px-2 py-2">{renderStatus(item.status)}</td>
                  <td className="px-2 py-2">
                    {new Date(item.paid_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="max-w-[240px] truncate px-2 py-2">
                    {item.content_html || "-"}
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
                          navigate(`/dashboard/deposits/${item.id}`)
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        onClick={() => void deleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
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
    </section>
  );
}
