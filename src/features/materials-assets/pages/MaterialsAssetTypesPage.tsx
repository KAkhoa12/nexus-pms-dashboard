import { useEffect, useState } from "react";
import axios from "axios";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PaginationMeta } from "@/features/auth/types";
import {
  materialsAssetsApi,
  type MaterialAssetType,
} from "@/features/materials-assets/api/materials-assets.api";

type ApiErrorBody = { message?: string };
type DeletedMode = "active" | "trash" | "all";

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function MaterialsAssetTypesPage() {
  const [items, setItems] = useState<MaterialAssetType[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    items_per_page: 10,
    total_items: 0,
    total_pages: 1,
  });

  const [mode, setMode] = useState<DeletedMode>("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [newTypeName, setNewTypeName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");

  useEffect(() => {
    void loadItems();
  }, [mode, page, pageSize, search]);

  async function loadItems() {
    try {
      const data = await materialsAssetsApi.listTypes({
        mode,
        page,
        itemsPerPage: pageSize,
        searchKey: search.trim() || undefined,
      });
      setItems(data.items);
      setPagination(data.pagination);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể tải danh sách loại tài sản."),
      );
    }
  }

  async function createAssetType() {
    const normalizedName = newTypeName.trim();
    if (!normalizedName) {
      toast.error("Vui lòng nhập tên loại vật tư.");
      return;
    }
    try {
      await materialsAssetsApi.createType({ name: normalizedName });
      setNewTypeName("");
      setPage(1);
      await loadItems();
      toast.success("Đã thêm loại vật tư.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể thêm loại vật tư."));
    }
  }

  function startEdit(item: MaterialAssetType) {
    setEditingTypeId(item.id);
    setEditingTypeName(item.name);
  }

  function cancelEdit() {
    setEditingTypeId(null);
    setEditingTypeName("");
  }

  async function saveEdit() {
    if (!editingTypeId) return;
    const normalizedName = editingTypeName.trim();
    if (!normalizedName) {
      toast.error("Tên loại vật tư không được để trống.");
      return;
    }
    try {
      await materialsAssetsApi.updateType(editingTypeId, { name: normalizedName });
      cancelEdit();
      await loadItems();
      toast.success("Cập nhật loại vật tư thành công.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể cập nhật loại vật tư."));
    }
  }

  async function removeType(item: MaterialAssetType) {
    try {
      if (item.deleted_at) {
        await materialsAssetsApi.removeTypeHard(item.id);
        toast.success("Đã xóa vĩnh viễn loại vật tư.");
      } else {
        await materialsAssetsApi.removeType(item.id);
        toast.success("Đã xóa mềm loại vật tư.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể xóa loại vật tư."));
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý vật tư</h1>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc và thao tác</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <Input
            className="md:col-span-2"
            placeholder="Tìm theo tên loại vật tư..."
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
              setMode(event.target.value as DeletedMode);
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
          <Input
            placeholder="Tên loại vật tư mới"
            value={newTypeName}
            onChange={(event) => setNewTypeName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void createAssetType();
              }
            }}
          />
          <Button type="button" onClick={() => void createAssetType()}>
            <Plus className="mr-1 h-4 w-4" />
            Thêm loại
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách loại vật tư</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Tên loại</th>
                <th className="px-2 py-2">Trạng thái</th>
                <th className="px-2 py-2">Cập nhật</th>
                <th className="px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isEditing = editingTypeId === item.id;
                return (
                  <tr key={item.id} className="border-b">
                    <td className="px-2 py-2 font-medium">{item.id}</td>
                    <td className="px-2 py-2">
                      {isEditing ? (
                        <Input
                          value={editingTypeName}
                          onChange={(event) =>
                            setEditingTypeName(event.target.value)
                          }
                        />
                      ) : (
                        item.name
                      )}
                    </td>
                    <td className="px-2 py-2">
                      {item.deleted_at ? "Đã xóa mềm" : "Đang hoạt động"}
                    </td>
                    <td className="px-2 py-2">
                      {new Date(item.updated_at).toLocaleString("vi-VN", {
                        hour12: false,
                      })}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void saveEdit()}
                            >
                              Lưu
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={cancelEdit}
                              aria-label="Hủy chỉnh sửa"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              disabled={Boolean(item.deleted_at)}
                              onClick={() => startEdit(item)}
                              aria-label="Sửa loại vật tư"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant={
                                item.deleted_at ? "destructive" : "outline"
                              }
                              onClick={() => void removeType(item)}
                              aria-label={
                                item.deleted_at
                                  ? "Xóa vĩnh viễn"
                                  : "Xóa mềm loại vật tư"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-2 py-6 text-center text-muted-foreground"
                  >
                    Không có loại vật tư phù hợp.
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
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((previous) => Math.max(1, previous - 1))}
              >
                Trước
              </Button>
              <Button
                type="button"
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
    </section>
  );
}
