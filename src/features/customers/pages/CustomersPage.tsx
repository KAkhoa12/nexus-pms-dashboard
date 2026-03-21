import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Plus, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  customersApi,
  type CustomerLeaseState,
  type CustomerListItem,
  type CustomerRentStateFilter,
  type CustomerType,
  type CustomerTypeFilter,
} from "@/features/customers/api/customers.api";
import { getAccessToken } from "@/services/auth/token";
import { storage } from "@/services/storage";
import { useAuthStore } from "@/store/auth.store";

type ApiErrorBody = { message?: string };
type DeletedMode = "active" | "trash" | "all";

const ACTIVE_WORKSPACE_STORAGE_KEY = "active_workspace_key";

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function toIdentityDisplay(item: {
  identity_type: string | null;
  id_number: string | null;
}): string {
  const identityType = item.identity_type || "-";
  const idNumber = item.id_number || "-";
  return `${identityType} ${idNumber}`;
}

function getLeaseStateLabel(state: CustomerLeaseState): string {
  if (state === "ACTIVE") return "Đang thuê";
  if (state === "PAST") return "Đã thuê";
  return "Chưa thuê";
}

function resolveCustomerAvatarUrl(
  rawUrl: string,
  accessToken: string | null,
  workspaceKey: string,
): string {
  const normalized = (rawUrl || "").trim();
  if (!normalized) return "";

  const toAbsolute = (relativePath: string) =>
    new URL(relativePath, window.location.origin).toString();
  const encodedObjectName = (value: string) =>
    value
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
  const withAuth = (urlLike: string) => {
    try {
      const parsed = new URL(urlLike, window.location.origin);
      if (accessToken && !parsed.searchParams.get("token")) {
        parsed.searchParams.set("token", accessToken);
      }
      if (workspaceKey && !parsed.searchParams.get("workspace_key")) {
        parsed.searchParams.set("workspace_key", workspaceKey);
      }
      return parsed.toString();
    } catch {
      return urlLike;
    }
  };

  if (normalized.startsWith("tenant-")) {
    return withAuth(
      toAbsolute(`/api/v1/customers/files/${encodedObjectName(normalized)}`),
    );
  }

  try {
    const parsed = new URL(normalized, window.location.origin);
    if (!parsed.pathname.startsWith("/api/v1/customers/files/")) {
      return normalized;
    }
    return withAuth(parsed.toString());
  } catch {
    return normalized;
  }
}

export function CustomersPage() {
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const preferencesWorkspaceKey = useAuthStore(
    (state) => state.preferences?.workspaceKey,
  );

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<CustomerListItem[]>([]);
  const [renters, setRenters] = useState<CustomerListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [mode, setMode] = useState<DeletedMode>("active");
  const [customerTypeFilter, setCustomerTypeFilter] =
    useState<CustomerTypeFilter>("all");
  const [rentStateFilter, setRentStateFilter] =
    useState<CustomerRentStateFilter>("all");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [loadingRenters, setLoadingRenters] = useState(false);

  const [customerType, setCustomerType] = useState<CustomerType>("renter");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [identityType, setIdentityType] = useState("CCCD");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [relation, setRelation] = useState("");
  const [primaryRenterQuery, setPrimaryRenterQuery] = useState("");
  const [selectedPrimaryRenter, setSelectedPrimaryRenter] =
    useState<CustomerListItem | null>(null);

  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadedAvatarUrls, setUploadedAvatarUrls] = useState<string[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarUploadInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveAccessToken = accessToken || getAccessToken();
  const effectiveWorkspaceKey =
    (
      preferencesWorkspaceKey ||
      storage.get(ACTIVE_WORKSPACE_STORAGE_KEY) ||
      "personal"
    ).trim() || "personal";

  const filteredRenters = useMemo(() => {
    const normalized = primaryRenterQuery.trim().toLowerCase();
    if (!normalized) return renters.slice(0, 20);
    return renters
      .filter((item) => {
        const searchable = `${item.id} ${item.full_name} ${item.phone} ${item.email || ""}`;
        return searchable.toLowerCase().includes(normalized);
      })
      .slice(0, 20);
  }, [primaryRenterQuery, renters]);

  const renterNameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const renter of renters) {
      map.set(renter.id, renter.full_name);
    }
    return map;
  }, [renters]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    void loadCustomers(page);
  }, [mode, customerTypeFilter, rentStateFilter, page, pageSize, keyword]);

  useEffect(() => {
    void loadRenters();
  }, []);

  async function loadCustomers(targetPage: number) {
    setLoading(true);
    try {
      const result = await customersApi.listCustomers({
        mode,
        page: targetPage,
        itemsPerPage: pageSize,
        searchKey: keyword.trim() || undefined,
        customerType: customerTypeFilter,
        rentState: rentStateFilter,
      });
      setItems(result.items);
      setTotalItems(result.pagination.total_items);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể tải danh sách khách hàng."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadRenters() {
    setLoadingRenters(true);
    try {
      const result = await customersApi.listCustomers({
        mode: "active",
        page: 1,
        itemsPerPage: 200,
        customerType: "renter",
        rentState: "all",
      });
      setRenters(result.items.filter((item) => item.customerType === "renter"));
    } catch {
      setRenters([]);
    } finally {
      setLoadingRenters(false);
    }
  }

  function resetForm() {
    setCustomerType("renter");
    setFullName("");
    setPhone("");
    setIdentityType("CCCD");
    setIdNumber("");
    setEmail("");
    setDob("");
    setAddress("");
    setRelation("");
    setPrimaryRenterQuery("");
    setSelectedPrimaryRenter(null);
    setAvatarUrl("");
    setUploadedAvatarUrls([]);
  }

  function handleApplySearch() {
    setPage(1);
    setKeyword(keywordInput.trim());
  }

  function openCreateDialog() {
    resetForm();
    setIsCreateDialogOpen(true);
    if (renters.length === 0) {
      void loadRenters();
    }
  }

  async function handleCreateCustomer() {
    if (fullName.trim().length < 2) {
      toast.error("Họ tên cần ít nhất 2 ký tự.");
      return;
    }
    if (phone.trim().length < 6) {
      toast.error("Số điện thoại không hợp lệ.");
      return;
    }
    if (customerType === "member" && !selectedPrimaryRenter) {
      toast.error("Vui lòng chọn khách thuê chính.");
      return;
    }

    setSavingCustomer(true);
    try {
      await customersApi.createCustomer({
        customerType,
        full_name: fullName.trim(),
        phone: phone.trim(),
        identity_type: identityType || undefined,
        id_number: idNumber.trim() || undefined,
        email: email.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        date_of_birth: dob ? `${dob}T00:00:00` : undefined,
        address: address.trim() || undefined,
        relation:
          customerType === "member" ? relation.trim() || undefined : undefined,
        renter_id:
          customerType === "member" ? selectedPrimaryRenter?.id : undefined,
      });
      toast.success("Thêm khách hàng thành công.");
      setIsCreateDialogOpen(false);
      resetForm();
      setPage(1);
      await Promise.all([loadCustomers(1), loadRenters()]);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể thêm khách hàng."));
    } finally {
      setSavingCustomer(false);
    }
  }

  function openAvatarPicker() {
    if (uploadingAvatar) return;
    avatarUploadInputRef.current?.click();
  }

  async function handleAvatarFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploadingAvatar(true);
    try {
      const uploaded = await Promise.all(
        files.map((file) => customersApi.uploadAvatar(file)),
      );
      const objectNames = uploaded
        .map((item) => (item.object_name || "").trim())
        .filter((item) => item.length > 0);

      if (objectNames.length === 0) {
        toast.error("Không nhận được object ảnh sau khi upload.");
        return;
      }

      setUploadedAvatarUrls((previous) => {
        const next = Array.from(new Set([...previous, ...objectNames]));
        if (!avatarUrl && next.length > 0) {
          setAvatarUrl(next[0]);
        }
        return next;
      });
      toast.success(`Đã upload ${objectNames.length} ảnh khách hàng.`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Upload ảnh khách hàng thất bại."));
    } finally {
      setUploadingAvatar(false);
      if (avatarUploadInputRef.current) avatarUploadInputRef.current.value = "";
      event.target.value = "";
    }
  }

  function removeUploadedAvatar(objectName: string) {
    setUploadedAvatarUrls((previous) =>
      previous.filter((item) => item !== objectName),
    );
    if (avatarUrl === objectName) {
      setAvatarUrl("");
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Khách hàng</h1>
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="mr-1 h-4 w-4" />
          Thêm khách hàng
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc khách hàng</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-7">
          <Input
            className="md:col-span-2"
            placeholder="Tìm theo tên, email, sdt..."
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleApplySearch();
              }
            }}
          />
          <Button type="button" onClick={handleApplySearch}>
            <Search className="mr-1 h-4 w-4" />
            Tìm kiếm
          </Button>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={customerTypeFilter}
            onChange={(event) => {
              setCustomerTypeFilter(event.target.value as CustomerTypeFilter);
              setPage(1);
            }}
          >
            <option value="all">Loại: Tất cả</option>
            <option value="renter">Khách thuê</option>
            <option value="member">Khách thuê cùng</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={rentStateFilter}
            onChange={(event) => {
              setRentStateFilter(event.target.value as CustomerRentStateFilter);
              setPage(1);
            }}
          >
            <option value="all">Tình trạng thuê: Tất cả</option>
            <option value="active">Đang thuê</option>
            <option value="past">Đã thuê</option>
            <option value="not_rented">Chưa thuê</option>
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={String(pageSize)}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value="10">10 / trang</option>
            <option value="20">20 / trang</option>
            <option value="50">50 / trang</option>
            <option value="100">100 / trang</option>
            <option value="200">200 / trang</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách khách hàng</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Ảnh</th>
                  <th className="px-2 py-2">Loại</th>
                  <th className="px-2 py-2">Họ tên</th>
                  <th className="px-2 py-2">Điện thoại</th>
                  <th className="px-2 py-2">Giấy tờ</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Tình trạng thuê</th>
                  <th className="px-2 py-2">Khách thuê chính</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const avatarSrc = item.avatar_url
                    ? resolveCustomerAvatarUrl(
                        item.avatar_url,
                        effectiveAccessToken,
                        effectiveWorkspaceKey,
                      )
                    : "";

                  return (
                    <tr
                      key={`${item.customerType}-${item.id}`}
                      className="cursor-pointer border-b hover:bg-muted/40"
                      onClick={() =>
                        navigate(
                          `/dashboard/customers/${item.customerType}/${item.id}`,
                        )
                      }
                    >
                      <td className="px-2 py-2">{item.id}</td>
                      <td className="px-2 py-2">
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt={item.full_name}
                            className="h-9 w-9 rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed text-xs text-muted-foreground">
                            --
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {item.customerType === "renter"
                          ? "Khách thuê"
                          : "Khách thuê cùng"}
                      </td>
                      <td className="px-2 py-2">{item.full_name}</td>
                      <td className="px-2 py-2">{item.phone}</td>
                      <td className="px-2 py-2">{toIdentityDisplay(item)}</td>
                      <td className="px-2 py-2">{item.email || "-"}</td>
                      <td className="px-2 py-2">
                        {getLeaseStateLabel(item.lease_state)}
                      </td>
                      <td className="px-2 py-2">
                        {item.renter_id
                          ? renterNameMap.get(item.renter_id) ||
                            item.primary_renter_name ||
                            `#${item.renter_id}`
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!loading && items.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                Không có khách hàng phù hợp.
              </p>
            ) : null}
            {loading ? (
              <p className="p-3 text-sm text-muted-foreground">
                Đang tải dữ liệu...
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Tổng {totalItems} bản ghi - Trang {page}/{totalPages}
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
                disabled={page >= totalPages}
                onClick={() =>
                  setPage((previous) => Math.min(totalPages, previous + 1))
                }
              >
                Sau
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thêm khách hàng</DialogTitle>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Loại khách hàng</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={customerType}
                onChange={(event) => {
                  const value = event.target.value as CustomerType;
                  setCustomerType(value);
                  if (value === "renter") {
                    setRelation("");
                    setPrimaryRenterQuery("");
                    setSelectedPrimaryRenter(null);
                  }
                }}
              >
                <option value="renter">Khách thuê</option>
                <option value="member">Khách thuê cùng</option>
              </select>
            </div>

            {customerType === "member" ? (
              <div className="space-y-2 md:col-span-2">
                <Label>Khách thuê chính</Label>
                <Input
                  placeholder="Nhập tên / email / sdt để tìm khách thuê chính"
                  value={
                    selectedPrimaryRenter
                      ? `${selectedPrimaryRenter.full_name} - ${selectedPrimaryRenter.phone}`
                      : primaryRenterQuery
                  }
                  onChange={(event) => {
                    setSelectedPrimaryRenter(null);
                    setPrimaryRenterQuery(event.target.value);
                  }}
                />

                {selectedPrimaryRenter ? (
                  <div className="flex items-center justify-between rounded-md border border-primary/40 bg-primary/5 p-2 text-sm">
                    <div>
                      <p className="font-medium">
                        {selectedPrimaryRenter.full_name}
                      </p>
                      <p className="text-muted-foreground">
                        {selectedPrimaryRenter.phone} -{" "}
                        {selectedPrimaryRenter.email || "Không có email"}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPrimaryRenter(null);
                        setPrimaryRenterQuery("");
                      }}
                    >
                      Đổi
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-2">
                    {loadingRenters ? (
                      <p className="text-xs text-muted-foreground">
                        Đang tải khách thuê chính...
                      </p>
                    ) : null}
                    {!loadingRenters && filteredRenters.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Không tìm thấy khách thuê chính phù hợp.
                      </p>
                    ) : null}
                    {filteredRenters.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setSelectedPrimaryRenter(item);
                          setPrimaryRenterQuery("");
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate">{item.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.email || "-"} - {item.phone}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Họ tên</Label>
              <Input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Số điện thoại</Label>
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Loại giấy tờ</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={identityType}
                onChange={(event) => setIdentityType(event.target.value)}
              >
                <option value="CCCD">CCCD</option>
                <option value="CMND">CMND</option>
                <option value="PASSPORT">Hộ chiếu</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Số giấy tờ</Label>
              <Input
                value={idNumber}
                onChange={(event) => setIdNumber(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ngày sinh</Label>
              <Input
                type="date"
                value={dob}
                onChange={(event) => setDob(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Địa chỉ</Label>
              <Input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
            {customerType === "member" ? (
              <div className="space-y-2">
                <Label>Quan hệ với khách thuê chính</Label>
                <Input
                  value={relation}
                  onChange={(event) => setRelation(event.target.value)}
                  placeholder="Ví dụ: Bạn cùng phòng"
                />
              </div>
            ) : null}

            <div className="space-y-2 md:col-span-3">
              <div className="flex items-center justify-between">
                <Label>Ảnh khách hàng (MinIO, hỗ trợ nhiều ảnh)</Label>
                <input
                  ref={avatarUploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleAvatarFilesChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={openAvatarPicker}
                  disabled={uploadingAvatar}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  {uploadingAvatar ? "Đang upload..." : "Upload ảnh"}
                </Button>
              </div>

              {uploadedAvatarUrls.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {uploadedAvatarUrls.map((objectName) => {
                    const resolved = resolveCustomerAvatarUrl(
                      objectName,
                      effectiveAccessToken,
                      effectiveWorkspaceKey,
                    );
                    const isPrimary = avatarUrl === objectName;
                    return (
                      <div
                        key={objectName}
                        className="space-y-2 rounded-md border border-border/70 p-2"
                      >
                        <img
                          src={resolved}
                          alt="avatar"
                          className="h-24 w-full rounded object-cover"
                          loading="lazy"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="flex-1"
                            variant={isPrimary ? "default" : "outline"}
                            onClick={() => setAvatarUrl(objectName)}
                          >
                            {isPrimary ? "Ảnh chính" : "Chọn ảnh"}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            onClick={() => removeUploadedAvatar(objectName)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Chưa có ảnh upload. Bạn có thể chọn một hoặc nhiều ảnh.
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              disabled={savingCustomer}
              onClick={() => void handleCreateCustomer()}
            >
              {savingCustomer ? "Đang lưu..." : "Thêm khách hàng"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
