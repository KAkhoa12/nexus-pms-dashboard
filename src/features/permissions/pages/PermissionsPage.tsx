import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { KeyRound, ListChecks, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usersApi } from "@/features/users/api/users.api";
import type {
  RolePermissionModuleGroup,
  RolePermissionCatalogItem,
  UserRoleCatalogItem,
} from "@/features/users/types";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

function PermissionSwitch({
  checked,
  onToggle,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        checked ? "bg-primary" : "bg-muted"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function isManagePermission(permissionCode: string): boolean {
  const parts = permissionCode.trim().split(":");
  return parts[parts.length - 1] === "manage";
}

function sortPermissionsByManageFirst(
  left: RolePermissionCatalogItem,
  right: RolePermissionCatalogItem,
): number {
  const leftManage = isManagePermission(left.permission_code);
  const rightManage = isManagePermission(right.permission_code);
  if (leftManage !== rightManage) {
    return leftManage ? -1 : 1;
  }
  return left.permission_code.localeCompare(right.permission_code);
}

function sortPermissionsByModuleAndManage(
  left: RolePermissionCatalogItem,
  right: RolePermissionCatalogItem,
): number {
  if (left.module !== right.module) {
    return left.module.localeCompare(right.module);
  }
  return sortPermissionsByManageFirst(left, right);
}

export function PermissionsPage() {
  const [roles, setRoles] = useState<UserRoleCatalogItem[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [permissions, setPermissions] = useState<RolePermissionCatalogItem[]>(
    [],
  );
  const [permissionGroups, setPermissionGroups] = useState<
    RolePermissionModuleGroup[]
  >([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [refreshingPermissions, setRefreshingPermissions] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [createRoleDialogOpen, setCreateRoleDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [creatingRole, setCreatingRole] = useState(false);
  const permissionsTableRef = useRef<HTMLDivElement | null>(null);

  const selectedRole = useMemo(
    () => roles.find((item) => item.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  );

  const filteredPermissions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return permissions;
    return permissions.filter(
      (item) =>
        item.permission_code.toLowerCase().includes(normalizedKeyword) ||
        item.module.toLowerCase().includes(normalizedKeyword) ||
        (item.module_mean || "").toLowerCase().includes(normalizedKeyword) ||
        (item.description || "").toLowerCase().includes(normalizedKeyword),
    );
  }, [keyword, permissions]);

  const filteredPermissionGroups = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const sourceGroups =
      permissionGroups.length > 0
        ? permissionGroups
        : Object.values(
            permissions.reduce<Record<string, RolePermissionModuleGroup>>(
              (accumulator, item) => {
                if (!accumulator[item.module]) {
                  accumulator[item.module] = {
                    module: item.module,
                    module_mean: item.module_mean,
                    has_manage_active: false,
                    permissions: [],
                  };
                }
                accumulator[item.module].permissions.push(item);
                return accumulator;
              },
              {},
            ),
          );

    return sourceGroups
      .map((group) => {
        const permissionsInGroup = [...group.permissions].sort(
          sortPermissionsByManageFirst,
        );
        const hasManageActive = permissionsInGroup.some(
          (item) => isManagePermission(item.permission_code) && item.is_active,
        );
        const filteredInGroup = !normalizedKeyword
          ? permissionsInGroup
          : permissionsInGroup.filter((item) => {
              const searchable =
                `${item.permission_code} ${item.description || ""} ${item.module} ${item.module_mean || ""}`.toLowerCase();
              return normalizedKeyword
                .split(/\s+/)
                .every((token) => searchable.includes(token));
            });
        return {
          module: group.module,
          module_mean: group.module_mean,
          has_manage_active: hasManageActive,
          permissions: filteredInGroup,
        };
      })
      .filter(
        (group) =>
          group.permissions.length > 0 ||
          group.module.toLowerCase().includes(normalizedKeyword) ||
          (group.module_mean || "").toLowerCase().includes(normalizedKeyword),
      )
      .sort((left, right) => {
        const leftLabel = left.module_mean || left.module;
        const rightLabel = right.module_mean || right.module;
        return leftLabel.localeCompare(rightLabel);
      });
  }, [keyword, permissionGroups, permissions]);

  useEffect(() => {
    void loadRoles();
  }, []);

  useEffect(() => {
    if (!selectedRoleId) {
      setPermissions([]);
      return;
    }
    void loadRolePermissions(selectedRoleId);
  }, [selectedRoleId]);

  async function loadRoles() {
    setLoadingRoles(true);
    try {
      const roleCatalog = await usersApi.rolesCatalog();
      setRoles(roleCatalog);
      setSelectedRoleId((current) =>
        current && roleCatalog.some((item) => item.id === current)
          ? current
          : roleCatalog[0]?.id || null,
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách vai trò."));
    } finally {
      setLoadingRoles(false);
    }
  }

  async function loadRolePermissions(
    roleId: number,
    options?: {
      silent?: boolean;
      preserveWindowScroll?: number | null;
      preserveTableScroll?: number | null;
    },
  ) {
    const silent = options?.silent === true;
    if (silent) {
      setRefreshingPermissions(true);
    } else {
      setLoadingPermissions(true);
    }
    try {
      const data = await usersApi.rolePermissions(roleId);
      setPermissions(
        [...data.permissions].sort(sortPermissionsByModuleAndManage),
      );
      setPermissionGroups(
        (data.modules || []).map((group) => ({
          ...group,
          permissions: [...group.permissions].sort(
            sortPermissionsByManageFirst,
          ),
        })),
      );
      if (
        options?.preserveWindowScroll != null ||
        options?.preserveTableScroll != null
      ) {
        window.requestAnimationFrame(() => {
          if (options?.preserveWindowScroll != null) {
            window.scrollTo({
              top: options.preserveWindowScroll,
              behavior: "auto",
            });
          }
          if (
            permissionsTableRef.current &&
            options?.preserveTableScroll != null
          ) {
            permissionsTableRef.current.scrollTop = options.preserveTableScroll;
          }
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải quyền của vai trò."));
      setPermissions([]);
      setPermissionGroups([]);
    } finally {
      if (silent) {
        setRefreshingPermissions(false);
      } else {
        setLoadingPermissions(false);
      }
    }
  }

  async function togglePermission(
    permissionCode: string,
    currentValue: boolean,
  ) {
    if (!selectedRoleId) return;
    const nextValue = !currentValue;
    try {
      const currentWindowScroll = window.scrollY;
      const currentTableScroll = permissionsTableRef.current?.scrollTop ?? null;
      await usersApi.setRolePermissionActive(
        selectedRoleId,
        permissionCode,
        nextValue,
      );
      await loadRolePermissions(selectedRoleId, {
        silent: true,
        preserveWindowScroll: currentWindowScroll,
        preserveTableScroll: currentTableScroll,
      });
      toast.success("Cập nhật quyền của vai trò thành công.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Cập nhật quyền thất bại."));
    }
  }

  async function handleCreateRole() {
    const normalizedName = newRoleName.trim();
    if (!normalizedName) {
      toast.error("Bạn cần nhập tên vai trò.");
      return;
    }

    setCreatingRole(true);
    try {
      const createdRole = await usersApi.createRole({
        name: normalizedName,
        description: newRoleDescription.trim() || undefined,
      });
      await loadRoles();
      setSelectedRoleId(createdRole.id);
      setCreateRoleDialogOpen(false);
      setNewRoleName("");
      setNewRoleDescription("");
      toast.success("Đã tạo vai trò mới.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tạo vai trò mới."));
    } finally {
      setCreatingRole(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Quản lý quyền theo vai trò</h1>
        <p className="text-sm text-muted-foreground">
          Chủ workspace có thể bật/tắt permission cho nhiều role, không giới hạn
          riêng ADMIN.
        </p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="lg:sticky lg:top-0 lg:flex lg:max-h-[calc(100vh-7rem)] lg:self-start lg:flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Vai trò
              </CardTitle>
              <Button
                type="button"
                size="sm"
                onClick={() => setCreateRoleDialogOpen(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                Thêm vai trò
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto ">
            {loadingRoles ? (
              <p className="text-sm text-muted-foreground">
                Đang tải vai trò...
              </p>
            ) : null}
            {!loadingRoles && roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Chưa có vai trò khả dụng.
              </p>
            ) : null}
            {roles.map((role) => {
              const active = role.id === selectedRoleId;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition ${
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-semibold">{role.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {role.description || "Không có mô tả"}
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {selectedRole
                ? `Permission của role ${selectedRole.name}`
                : "Permission"}
            </CardTitle>
            <Input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Lọc theo code, mô tả, module..."
            />
          </CardHeader>
          <CardContent>
            {loadingPermissions && permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Đang tải permission của vai trò...
              </p>
            ) : null}

            {permissions.length > 0 ? (
              <div className="relative space-y-4">
                <div className="columns-1 gap-4 md:columns-2">
                  {filteredPermissionGroups.map((group) => (
                    <div
                      key={group.module}
                      className="mb-4 rounded-md border bg-muted/10 p-3 [break-inside:avoid]"
                    >
                      <div className="mb-2">
                        <p className="text-sm font-semibold">
                          {group.module_mean || group.module}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Module: {group.module}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {group.permissions.map((item) => {
                          const disabledByManage =
                            group.has_manage_active &&
                            !isManagePermission(item.permission_code);
                          return (
                            <div
                              key={`${group.module}-${item.permission_code}`}
                              className={`flex items-center justify-between cursor-pointer gap-3 rounded border px-2 py-1.5 ${
                                disabledByManage ? "bg-muted/40 opacity-80" : ""
                              }`}
                              onClick={() =>
                                void togglePermission(
                                  item.permission_code,
                                  item.is_active,
                                )
                              }
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {item.permission_code}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {item.description || "-"}
                                </p>
                              </div>
                              <PermissionSwitch
                                checked={item.is_active}
                                onToggle={() =>
                                  void togglePermission(
                                    item.permission_code,
                                    item.is_active,
                                  )
                                }
                                disabled={
                                  !selectedRoleId ||
                                  loadingPermissions ||
                                  refreshingPermissions ||
                                  disabledByManage
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!loadingPermissions && filteredPermissions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Không tìm thấy permission phù hợp.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={createRoleDialogOpen}
        onOpenChange={setCreateRoleDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm vai trò mới</DialogTitle>
            <DialogDescription>
              Tạo role mới để gán permission riêng theo nghiệp vụ của team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="newRoleName">Tên vai trò</Label>
              <Input
                id="newRoleName"
                value={newRoleName}
                onChange={(event) => setNewRoleName(event.target.value)}
                placeholder="Ví dụ: Kế toán, CSKH, Vận hành..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newRoleDescription">Mô tả (không bắt buộc)</Label>
              <Input
                id="newRoleDescription"
                value={newRoleDescription}
                onChange={(event) => setNewRoleDescription(event.target.value)}
                placeholder="Mô tả ngắn nhiệm vụ của vai trò"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateRoleDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateRole()}
              disabled={creatingRole}
            >
              Tạo vai trò
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
