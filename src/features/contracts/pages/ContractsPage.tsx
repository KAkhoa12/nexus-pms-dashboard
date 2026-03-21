import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, PencilLine, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PaginationMeta } from "@/features/auth/types";
import { contractsApi } from "@/features/contracts/api/contracts.api";
import type { DeletedMode, Lease } from "@/features/ops/types";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function renderStatus(status: Lease["status"]): string {
  if (status === "ACTIVE") return "Hiệu lực";
  if (status === "ENDED") return "Đã kết thúc";
  return "Đã hủy";
}

function renderRenterDisplay(item: Lease): string {
  const name = (item.renter_full_name || "").trim();
  const phone = (item.renter_phone || "").trim();
  if (name && phone) return `${name} - ${phone}`;
  if (name) return name;
  return `#${item.renter_id}`;
}

export function ContractsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Lease[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    items_per_page: 10,
    total_items: 0,
    total_pages: 1,
  });
  const [deletedMode, setDeletedMode] = useState<DeletedMode>("active");
  const [statusFilter, setStatusFilter] = useState<"all" | Lease["status"]>(
    "all",
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  const totalPages = Math.max(1, pagination.total_pages);
  const safePage = Math.min(page, totalPages);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await contractsApi.list({
        mode: deletedMode,
        page,
        itemsPerPage: pageSize,
        status: statusFilter === "all" ? undefined : statusFilter,
        searchKey: keyword.trim() || undefined,
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
      toast.error(
        getErrorMessage(error, "Không thể tải danh sách hợp đồng thuê."),
      );
    } finally {
      setLoading(false);
    }
  }, [deletedMode, keyword, page, pageSize, statusFilter]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  async function deleteItem(id: number) {
    try {
      await contractsApi.remove(id);
      toast.success("Đã đưa hợp đồng vào thùng rác.");
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa hợp đồng thất bại."));
    }
  }

  const rows = useMemo(() => items, [items]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Hợp đồng thuê</h1>
        <Button
          type="button"
          onClick={() => navigate("/dashboard/contracts/create")}
        >
          <Plus className="h-4 w-4" />
          Tạo hợp đồng
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Input
            placeholder="Tìm theo mã hợp đồng, phòng, khách thuê..."
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
          />
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "all" | Lease["status"]);
              setPage(1);
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="ACTIVE">Hiệu lực</option>
            <option value="ENDED">Đã kết thúc</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
          <select
            className="h-10 w-full rounded-md border bg-background px-3"
            value={deletedMode}
            onChange={(event) => {
              setDeletedMode(event.target.value as DeletedMode);
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
            onChange={(event) => {
              setPageSize(Number(event.target.value));
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
          <CardTitle>Danh sách hợp đồng</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Phòng</th>
                <th className="px-2 py-2">Khách thuê</th>
                <th className="px-2 py-2">Thời hạn</th>
                <th className="px-2 py-2">Giá thuê</th>
                <th className="px-2 py-2">Tiền cọc</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Cập nhật</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-b hover:bg-muted/30">
                  <td className="px-2 py-2">#{item.id}</td>
                  <td className="px-2 py-2">
                    {item.room_code
                      ? `${item.room_code} (#${item.room_id})`
                      : item.room_id}
                  </td>
                  <td className="px-2 py-2">{renderRenterDisplay(item)}</td>
                  <td className="px-2 py-2">
                    {new Date(item.start_date).toLocaleDateString("vi-VN")}
                    {item.end_date
                      ? ` - ${new Date(item.end_date).toLocaleDateString("vi-VN")}`
                      : ""}
                  </td>
                  <td className="px-2 py-2">{item.rent_price}</td>
                  <td className="px-2 py-2">{item.security_deposit_amount}</td>
                  <td className="px-2 py-2">{renderStatus(item.status)}</td>
                  <td className="px-2 py-2">
                    {new Date(item.updated_at).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-2 py-2 text-right">
                    {deletedMode !== "trash" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            navigate(`/dashboard/contracts/${item.id}`)
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            navigate(`/dashboard/contracts/${item.id}`)
                          }
                        >
                          <PencilLine className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => void deleteItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Đã xóa mềm
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    Không có dữ liệu hợp đồng.
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
