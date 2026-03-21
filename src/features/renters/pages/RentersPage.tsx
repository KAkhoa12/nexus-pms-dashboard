import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rentersApi } from "@/features/renters/api/renters.api";
import type { Renter } from "@/features/ops/types";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function RentersPage() {
  const [items, setItems] = useState<Renter[]>([]);
  const [selected, setSelected] = useState<Renter | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [identityType, setIdentityType] = useState("CCCD");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    void loadItems();
  }, []);

  async function loadItems() {
    try {
      const data = await rentersApi.list("active");
      setItems(data);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải người thuê."));
    }
  }

  async function saveItem() {
    try {
      const payload = {
        full_name: fullName,
        phone,
        identity_type: identityType || undefined,
        id_number: idNumber || undefined,
        email: email || undefined,
        avatar_url: avatarUrl || undefined,
        date_of_birth: dob || undefined,
        address: address || undefined,
      };
      if (selected) {
        await rentersApi.update(selected.id, payload);
        toast.success("Cập nhật người thuê thành công.");
      } else {
        await rentersApi.create(payload);
        toast.success("Thêm người thuê thành công.");
      }
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Lưu người thuê thất bại."));
    }
  }

  async function deleteItem() {
    if (!selected) return;
    try {
      await rentersApi.remove(selected.id);
      setSelected(null);
      setFullName("");
      setPhone("");
      setIdentityType("CCCD");
      setIdNumber("");
      setEmail("");
      setAvatarUrl("");
      setDob("");
      setAddress("");
      toast.success("Xóa mềm người thuê thành công.");
      await loadItems();
    } catch (error) {
      toast.error(getErrorMessage(error, "Xóa người thuê thất bại."));
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Quản lý người thuê</h1>
      <Card>
        <CardHeader>
          <CardTitle>Thông tin người thuê</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
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
          <CardTitle>Danh sách người thuê</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-2 py-2">ID</th>
                <th className="px-2 py-2">Họ tên</th>
                <th className="px-2 py-2">Điện thoại</th>
                <th className="px-2 py-2">Giấy tờ</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Địa chỉ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer border-b hover:bg-muted/40"
                  onClick={() => {
                    setSelected(item);
                    setFullName(item.full_name);
                    setPhone(item.phone);
                    setIdentityType(item.identity_type || "CCCD");
                    setIdNumber(item.id_number || "");
                    setEmail(item.email || "");
                    setAvatarUrl(item.avatar_url || "");
                    setDob(item.date_of_birth || "");
                    setAddress(item.address || "");
                  }}
                >
                  <td className="px-2 py-2">{item.id}</td>
                  <td className="px-2 py-2">{item.full_name}</td>
                  <td className="px-2 py-2">{item.phone}</td>
                  <td className="px-2 py-2">
                    {item.identity_type || "-"} {item.id_number || "-"}
                  </td>
                  <td className="px-2 py-2">{item.email || "-"}</td>
                  <td className="px-2 py-2">{item.address || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
