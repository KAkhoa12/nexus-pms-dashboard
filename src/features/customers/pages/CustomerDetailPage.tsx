import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  customersApi,
  type CustomerDetail,
  type CustomerPrimaryRenter,
  type CustomerListItem,
  type CustomerType,
} from "@/features/customers/api/customers.api";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function renderValue(value: string | null | undefined): string {
  if (!value) return "-";
  return value;
}

export function CustomerDetailPage() {
  const { customerType: customerTypeRaw, customerId: customerIdRaw } =
    useParams<{
      customerType?: string;
      customerId?: string;
    }>();
  const customerType = customerTypeRaw as CustomerType | undefined;
  const customerId = Number(customerIdRaw || 0);

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [primaryRenter, setPrimaryRenter] =
    useState<CustomerPrimaryRenter | null>(null);
  const [companions, setCompanions] = useState<CustomerListItem[]>([]);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [identityType, setIdentityType] = useState("CCCD");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [relation, setRelation] = useState("");

  const pageTitle = useMemo(() => {
    if (customerType === "member") return "Chi tiết khách thuê cùng";
    return "Chi tiết khách thuê";
  }, [customerType]);

  const loadDetail = useCallback(async () => {
    if (
      !customerType ||
      (customerType !== "renter" && customerType !== "member") ||
      !Number.isFinite(customerId) ||
      customerId <= 0
    ) {
      toast.error("Đường dẫn khách hàng không hợp lệ.");
      return;
    }

    setLoading(true);
    try {
      const loaded = await customersApi.getCustomerDetail(
        customerType,
        customerId,
      );
      setDetail(loaded);
      setPrimaryRenter(loaded.primaryRenter);
      setCompanions(loaded.companions);
    } catch (error) {
      setDetail(null);
      setPrimaryRenter(null);
      setCompanions([]);
      toast.error(getErrorMessage(error, "Không thể tải chi tiết khách hàng."));
    } finally {
      setLoading(false);
    }
  }, [customerId, customerType]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  function resetCompanionForm() {
    setFullName("");
    setPhone("");
    setIdentityType("CCCD");
    setIdNumber("");
    setEmail("");
    setAvatarUrl("");
    setDob("");
    setAddress("");
    setRelation("");
  }

  async function handleAddCompanion() {
    if (!detail) {
      toast.error("Không có dữ liệu khách hàng.");
      return;
    }
    if (fullName.trim().length < 2) {
      toast.error("Họ tên cần ít nhất 2 ký tự.");
      return;
    }
    if (phone.trim().length < 6) {
      toast.error("Số điện thoại không hợp lệ.");
      return;
    }
    try {
      await customersApi.addCompanion(customerType || "renter", customerId, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        identity_type: identityType || undefined,
        id_number: idNumber.trim() || undefined,
        email: email.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
        date_of_birth: dob.trim() || undefined,
        address: address.trim() || undefined,
        relation: relation.trim() || undefined,
      });
      toast.success("Thêm người thuê cùng thành công.");
      resetCompanionForm();
      const loaded = await customersApi.getCustomerDetail(
        customerType || "renter",
        customerId,
      );
      setDetail(loaded);
      setPrimaryRenter(loaded.primaryRenter);
      setCompanions(loaded.companions);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể thêm người thuê cùng."));
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{pageTitle}</h1>
        <Button variant="outline" asChild>
          <Link to="/dashboard/customers">Quay lại danh sách</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin khách hàng</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
          ) : null}

          {!loading && customerType === "renter" && detail ? (
            <div className="grid gap-2 md:grid-cols-2">
              <p>
                <strong>ID:</strong> {detail.customer.id}
              </p>
              <p>
                <strong>Họ tên:</strong> {detail.customer.full_name}
              </p>
              <p>
                <strong>Số điện thoại:</strong> {detail.customer.phone}
              </p>
              <p>
                <strong>Email:</strong> {renderValue(detail.customer.email)}
              </p>
              <p>
                <strong>Giấy tờ:</strong>{" "}
                {renderValue(detail.customer.identity_type)}{" "}
                {renderValue(detail.customer.id_number)}
              </p>
              <p>
                <strong>Địa chỉ:</strong> {renderValue(detail.customer.address)}
              </p>
            </div>
          ) : null}

          {!loading && customerType === "member" && detail ? (
            <div className="grid gap-2 md:grid-cols-2">
              <p>
                <strong>ID:</strong> {detail.customer.id}
              </p>
              <p>
                <strong>Họ tên:</strong> {detail.customer.full_name}
              </p>
              <p>
                <strong>Số điện thoại:</strong> {detail.customer.phone}
              </p>
              <p>
                <strong>Email:</strong> {renderValue(detail.customer.email)}
              </p>
              <p>
                <strong>Giấy tờ:</strong>{" "}
                {renderValue(detail.customer.identity_type)}{" "}
                {renderValue(detail.customer.id_number)}
              </p>
              <p>
                <strong>Quan hệ:</strong>{" "}
                {renderValue(detail.customer.relation)}
              </p>
              <p className="md:col-span-2">
                <strong>Khách thuê chính:</strong>{" "}
                {primaryRenter
                  ? `${primaryRenter.full_name} (#${primaryRenter.id})`
                  : `#${detail.customer.renter_id || "-"}`}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Người thuê cùng của khách hàng này</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!primaryRenter ? (
            <p className="text-sm text-muted-foreground">
              Không xác định được khách thuê chính.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Khách thuê chính:{" "}
              <span className="font-medium text-foreground">
                {primaryRenter.full_name} (#{primaryRenter.id})
              </span>
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-2 py-2">ID</th>
                  <th className="px-2 py-2">Họ tên</th>
                  <th className="px-2 py-2">SĐT</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Quan hệ</th>
                </tr>
              </thead>
              <tbody>
                {companions.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-2 py-2">{item.id}</td>
                    <td className="px-2 py-2">{item.full_name}</td>
                    <td className="px-2 py-2">{item.phone}</td>
                    <td className="px-2 py-2">{item.email || "-"}</td>
                    <td className="px-2 py-2">{item.relation || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {companions.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                Chưa có người thuê cùng.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-lg border border-border/70 p-3 md:grid-cols-3">
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
              <Label>Quan hệ</Label>
              <Input
                value={relation}
                onChange={(event) => setRelation(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ngày sinh (ISO)</Label>
              <Input
                value={dob}
                onChange={(event) => setDob(event.target.value)}
                placeholder="2026-03-18T00:00:00+07:00"
              />
            </div>
            <div className="space-y-2">
              <Label>Địa chỉ</Label>
              <Input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ảnh đại diện (URL)</Label>
              <Input
                value={avatarUrl}
                onChange={(event) => setAvatarUrl(event.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <Button type="button" onClick={() => void handleAddCompanion()}>
                Thêm người thuê cùng
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
