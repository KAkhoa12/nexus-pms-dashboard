import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renterMembersApi } from "@/features/renter-members/api/renter-members.api";
import type { RenterMember } from "@/features/ops/types";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function RenterMembersPage() {
  const [items, setItems] = useState<RenterMember[]>([]);
  const [selected, setSelected] = useState<RenterMember | null>(null);
  const [renterId, setRenterId] = useState("1");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [identityType, setIdentityType] = useState("CCCD");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [relation, setRelation] = useState("");

  useEffect(() => {
    void loadItems();
  }, []);

  async function loadItems() {
    try {
      const data = await renterMembersApi.list("active");
      setItems(data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải người đi cùng."));
    }
  }

  async function saveItem() {
    try {
      const payload = {
        renter_id: Number(renterId),
        full_name: fullName,
        phone,
        identity_type: identityType || undefined,
        id_number: idNumber || undefined,
        email: email || undefined,
        avatar_url: avatarUrl || undefined,
        date_of_birth: dob || undefined,
        address: address || undefined,
        relation: relation || undefined,
      };
      if (selected) {
        await renterMembersApi.update(selected.id, payload);
        toast.success("Cập nhật người đi cùng thành công.");
      } else {
        await renterMembersApi.create(payload);
        toast.success("Thêm người đi cùng thành công.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu người đi cùng thất bại."));
    }
  }

  async function deleteItem() {
    if (!selected) return;
    try {
      await renterMembersApi.remove(selected.id);
      setSelected(null);
      setRenterId("1");
      setFullName("");
      setPhone("");
      setIdentityType("CCCD");
      setIdNumber("");
      setEmail("");
      setAvatarUrl("");
      setDob("");
      setAddress("");
      setRelation("");
      toast.success("Xóa mềm người đi cùng thành công.");
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa người đi cùng thất bại."));
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý người đi cùng</h1>
      <Card>
        <CardHeader>
          <CardTitle>Thông tin người đi cùng</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Renter ID</Label>
            <Input
              value={renterId}
              onChange={(e) => setRenterId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Họ tên</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Điện thoại</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Loại giấy tờ</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3"
              value={identityType}
              onChange={(e) => setIdentityType(e.target.value)}
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
              onChange={(e) => setIdNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ảnh (URL)</Label>
            <Input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Ngày sinh (ISO)</Label>
            <Input
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              placeholder="2026-01-01T00:00:00+07:00"
            />
          </div>
          <div className="space-y-2">
            <Label>Địa chỉ</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Quan hệ</Label>
            <Input
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
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
          <CardTitle>Danh sách người đi cùng</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Renter ID</th>
                <th className="px-2 py-2">Họ tên</th>
                <th className="px-2 py-2">Điện thoại</th>
                <th className="px-2 py-2">Giấy tờ</th>
                <th className="px-2 py-2">Email</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() => {
                    setSelected(item);
                    setRenterId(String(item.renter_id));
                    setFullName(item.full_name);
                    setPhone(item.phone);
                    setIdentityType(item.identity_type || "CCCD");
                    setIdNumber(item.id_number || "");
                    setEmail(item.email || "");
                    setAvatarUrl(item.avatar_url || "");
                    setDob(item.date_of_birth || "");
                    setAddress(item.address || "");
                    setRelation(item.relation || "");
                  }}
                >
                  <td className="px-2 py-2">{item.id}</td>
                  <td className="px-2 py-2">{item.renter_id}</td>
                  <td className="px-2 py-2">{item.full_name}</td>
                  <td className="px-2 py-2">{item.phone}</td>
                  <td className="px-2 py-2">
                    {item.identity_type || "-"} {item.id_number || "-"}
                  </td>
                  <td className="px-2 py-2">{item.email || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
