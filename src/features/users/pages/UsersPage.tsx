import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Search, Shield, Trash2, UserPlus } from "lucide-react";
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
import { teamsApi } from "@/features/teams";
import type { Team, TeamMember, TeamMemberCandidate } from "@/features/teams";
import { authApi } from "@/features/auth/api/auth.api";
import { usersApi } from "@/features/users/api/users.api";
import type { UserRoleCatalogItem } from "@/features/users/types";
import { storage } from "@/services/storage";
import { useAuthStore } from "@/store/auth.store";

const WORKSPACE_KEY = "active_workspace_key";

type ApiErrorBody = { message?: string };

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.message ?? error.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

export function UsersPage() {
  const user = useAuthStore((state) => state.user);
  const subscription = useAuthStore((state) => state.subscription);
  const setPreferences = useAuthStore((state) => state.setPreferences);
  const isBusinessPackage = subscription?.packageCode === "BUSINESS";

  const [teams, setTeams] = useState<Team[]>([]);
  const [roleCatalog, setRoleCatalog] = useState<UserRoleCatalogItem[]>([]);
  const [candidateUsers, setCandidateUsers] = useState<TeamMemberCandidate[]>(
    [],
  );
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<
    Record<number, number | "">
  >({});
  const [loading, setLoading] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteQueryDraft, setInviteQueryDraft] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<number[]>(
    [],
  );
  const [inviteRoleId, setInviteRoleId] = useState<number | "">("");
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [createTeamDialogOpen, setCreateTeamDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  const activeWorkspaceKey = storage.get(WORKSPACE_KEY) || "personal";
  const activeTeam = useMemo(() => {
    if (!activeWorkspaceKey.startsWith("team:")) return null;
    return (
      teams.find((item) => `team:${item.id}` === activeWorkspaceKey) || null
    );
  }, [teams, activeWorkspaceKey]);

  const isTeamManager = useMemo(() => {
    if (!activeTeam || !user?.id) return false;
    const membership = activeTeam.members.find(
      (item) => item.user_id === user.id,
    );
    return membership?.member_role === "MANAGER";
  }, [activeTeam, user?.id]);

  useEffect(() => {
    if (!isBusinessPackage) return;
    void loadData();
  }, [isBusinessPackage]);

  useEffect(() => {
    if (!activeTeam) {
      setMemberRoleDrafts({});
      return;
    }
    const next: Record<number, number | ""> = {};
    activeTeam.members.forEach((item) => {
      next[item.user_id] = item.rbac_role_id ?? "";
    });
    setMemberRoleDrafts(next);
  }, [activeTeam]);

  useEffect(() => {
    if (!inviteDialogOpen || !activeTeam) return;
    const timer = window.setTimeout(() => {
      const normalized = inviteQueryDraft.trim();
      setInviteQuery(normalized);
      void fetchCandidateUsers(normalized);
    }, 750);
    return () => {
      window.clearTimeout(timer);
    };
  }, [inviteDialogOpen, activeTeam?.id, inviteQueryDraft]);

  const selectedCandidates = useMemo(
    () =>
      candidateUsers.filter((item) =>
        selectedCandidateIds.includes(item.user_id),
      ),
    [selectedCandidateIds, candidateUsers],
  );

  const roleNameById = useMemo(() => {
    const map = new Map<number, string>();
    roleCatalog.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [roleCatalog]);

  async function loadData() {
    setLoading(true);
    try {
      const [myTeams, roles] = await Promise.all([
        teamsApi.getMyTeams(),
        usersApi.rolesCatalog(),
      ]);
      setTeams(myTeams);
      setRoleCatalog(roles);
      setInviteRoleId((current) => {
        if (current !== "") return current;
        return roles[0]?.id || "";
      });
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải dữ liệu nhân viên."));
    } finally {
      setLoading(false);
    }
  }

  async function fetchCandidateUsers(query: string) {
    if (!activeTeam) {
      setCandidateUsers([]);
      return;
    }
    setCandidateLoading(true);
    try {
      const items = await teamsApi.searchMemberCandidates({
        teamId: activeTeam.id,
        query,
        limit: 100,
      });
      setCandidateUsers(items);
      setSelectedCandidateIds([]);
    } catch (error) {
      setCandidateUsers([]);
      toast.error(getErrorMessage(error, "Không thể tìm kiếm nhân viên."));
    } finally {
      setCandidateLoading(false);
    }
  }

  function toggleCandidate(userId: number, checked: boolean) {
    setSelectedCandidateIds((prev) => {
      if (checked) {
        if (prev.includes(userId)) return prev;
        return [...prev, userId];
      }
      return prev.filter((id) => id !== userId);
    });
  }

  async function handleInviteMembers() {
    if (!activeTeam) return;
    if (!isTeamManager) {
      toast.error("Chỉ quản lý team mới được thêm thành viên.");
      return;
    }
    const inviteReadyCandidates = selectedCandidates.filter(
      (item) => item.is_active && !item.is_in_team,
    );
    if (inviteReadyCandidates.length === 0) {
      toast.error("Bạn chưa chọn nhân viên nào.");
      return;
    }
    if (inviteRoleId === "") {
      toast.error("Bạn cần chọn role cho nhân viên.");
      return;
    }

    setSubmittingInvite(true);
    let successCount = 0;
    const failures: string[] = [];

    for (const targetUser of inviteReadyCandidates) {
      try {
        await teamsApi.inviteMember({
          teamId: activeTeam.id,
          email: targetUser.email,
          rbacRoleId: inviteRoleId,
        });
        successCount += 1;
      } catch (error) {
        failures.push(
          `${targetUser.email}: ${getErrorMessage(error, "Không thể thêm vào team")}`,
        );
      }
    }

    setSubmittingInvite(false);
    if (successCount > 0) {
      toast.success(`Đã thêm ${successCount} nhân viên vào team.`);
    }
    if (failures.length > 0) {
      toast.error(failures[0]);
    }

    await loadData();
    if (successCount > 0) {
      setInviteDialogOpen(false);
      setInviteQuery("");
      setInviteQueryDraft("");
      setSelectedCandidateIds([]);
    }
  }

  async function handleKickMember(member: TeamMember) {
    if (!activeTeam) return;
    if (!isTeamManager) {
      toast.error("Chỉ quản lý team mới được loại thành viên.");
      return;
    }
    try {
      await teamsApi.kickMember({
        teamId: activeTeam.id,
        memberUserId: member.user_id,
      });
      toast.success("Đã loại thành viên khỏi team.");
      await loadData();
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể loại thành viên khỏi team."),
      );
    }
  }

  async function handleUpdateMemberRole(member: TeamMember) {
    if (!activeTeam) return;
    if (!isTeamManager) {
      toast.error("Chỉ quản lý team mới được đổi role thành viên.");
      return;
    }
    const roleId = memberRoleDrafts[member.user_id];
    if (roleId === "" || roleId === undefined) {
      toast.error("Bạn cần chọn role trước khi cập nhật.");
      return;
    }
    try {
      await teamsApi.updateMemberRole({
        teamId: activeTeam.id,
        memberUserId: member.user_id,
        rbacRoleId: roleId,
      });
      toast.success("Cập nhật role thành viên thành công.");
      await loadData();
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể cập nhật role thành viên."),
      );
    }
  }

  function openInviteDialog() {
    if (!activeTeam) {
      toast.error("Bạn cần chọn workspace team trước khi thêm nhân viên.");
      return;
    }
    if (!isTeamManager) {
      toast.error("Chỉ quản lý team mới được thêm thành viên.");
      return;
    }
    setInviteQueryDraft(inviteQuery);
    setInviteDialogOpen(true);
    void fetchCandidateUsers(inviteQuery.trim());
  }

  async function handleCreateTeam() {
    const normalizedName = newTeamName.trim();
    if (normalizedName.length < 2) {
      toast.error("Tên workspace team cần ít nhất 2 ký tự.");
      return;
    }
    setCreatingTeam(true);
    try {
      const team = await teamsApi.createTeam({
        name: normalizedName,
        description: newTeamDescription.trim() || undefined,
      });
      const workspaceKey = `team:${team.id}`;
      storage.set(WORKSPACE_KEY, workspaceKey);
      void authApi
        .updatePreferences({ workspace_key: workspaceKey })
        .then((response) => {
          setPreferences({ workspaceKey: response.workspace_key });
        })
        .catch(() => {
          toast.error("Không thể lưu workspace mặc định.");
        });
      setCreateTeamDialogOpen(false);
      setNewTeamName("");
      setNewTeamDescription("");
      toast.success("Đã tạo workspace team mới.");
      await loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tạo workspace team."));
    } finally {
      setCreatingTeam(false);
    }
  }

  if (!isBusinessPackage) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">
            Tính năng Nhân viên chỉ khả dụng ở gói Business.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Nhân viên trong team</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý thành viên theo workspace team, thêm nhiều nhân viên và phân
            quyền RBAC cho từng người.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setCreateTeamDialogOpen(true)}
          >
            Tạo workspace team
          </Button>
          <Button type="button" onClick={openInviteDialog}>
            <UserPlus className="mr-2 h-4 w-4" />
            Thêm nhân viên vào team
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Không gian đang chọn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeTeam ? (
            <>
              <p className="text-sm">
                Team: <span className="font-semibold">{activeTeam.name}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Quản lý team: {activeTeam.owner_full_name} (
                {activeTeam.owner_email})
              </p>
              <p className="text-sm text-muted-foreground">
                Vai trò của bạn trong team:{" "}
                <span className="font-medium">
                  {isTeamManager ? "MANAGER" : "MEMBER"}
                </span>
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Bạn đang ở workspace Personal hoặc team không còn khả dụng. Hãy
                chọn một team ở đầu sidebar hoặc tạo team mới để quản lý nhân
                viên.
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateTeamDialogOpen(true)}
              >
                Tạo workspace team ngay
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách thành viên team</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Đang tải dữ liệu...</p>
          ) : null}

          {!loading && !activeTeam ? (
            <p className="text-sm text-muted-foreground">
              Chưa có team đang được chọn.
            </p>
          ) : null}

          {!loading && activeTeam ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2">Thành viên</th>
                    <th className="px-2 py-2">Vai trò team</th>
                    <th className="px-2 py-2">RBAC role</th>
                    <th className="px-2 py-2 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTeam.members.map((member) => {
                    const isOwner = member.user_id === activeTeam.owner_user_id;
                    const roleDraft = memberRoleDrafts[member.user_id] ?? "";
                    return (
                      <tr key={member.id} className="border-b">
                        <td className="px-2 py-2">
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.email}
                          </p>
                        </td>
                        <td className="px-2 py-2">{member.member_role}</td>
                        <td className="px-2 py-2">
                          <div className="flex max-w-[280px] items-center gap-2">
                            <select
                              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                              value={roleDraft}
                              disabled={!isTeamManager || isOwner}
                              onChange={(event) => {
                                const nextValue = event.target.value;
                                setMemberRoleDrafts((prev) => ({
                                  ...prev,
                                  [member.user_id]:
                                    nextValue === "" ? "" : Number(nextValue),
                                }));
                              }}
                            >
                              <option value="">Chọn role</option>
                              {roleCatalog.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                !isTeamManager || isOwner || roleDraft === ""
                              }
                              onClick={() =>
                                void handleUpdateMemberRole(member)
                              }
                            >
                              <Shield className="mr-1 h-4 w-4" />
                              Lưu
                            </Button>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Hiện tại:{" "}
                            {member.rbac_role_id
                              ? roleNameById.get(member.rbac_role_id) ||
                                `Role #${member.rbac_role_id}`
                              : "-"}
                          </p>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={!isTeamManager || isOwner}
                            onClick={() => void handleKickMember(member)}
                          >
                            <Trash2 className="mr-1 h-4 w-4" />
                            Loại khỏi team
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Thêm nhân viên vào team</DialogTitle>
            <DialogDescription>
              Tìm theo email, số điện thoại, tên đăng nhập hoặc họ tên; chọn một
              hoặc nhiều người rồi gán role trước khi thêm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="inviteQuery">Tìm nhân viên</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="inviteQuery"
                  className="pl-9"
                  value={inviteQueryDraft}
                  onChange={(event) => setInviteQueryDraft(event.target.value)}
                  placeholder="Ví dụ: user@gmail.com, 091..., username..."
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Hệ thống tự gọi API tìm kiếm sau khoảng 0.75 giây mỗi lần bạn
                dừng gõ.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inviteRole">
                Role áp dụng cho các nhân viên đã chọn
              </Label>
              <select
                id="inviteRole"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={inviteRoleId}
                onChange={(event) => {
                  const value = event.target.value;
                  setInviteRoleId(value === "" ? "" : Number(value));
                }}
              >
                <option value="">Chọn role</option>
                {roleCatalog.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[40vh] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-2 py-2">Chọn</th>
                    <th className="px-2 py-2">Email</th>
                    <th className="px-2 py-2">Họ tên</th>
                    <th className="px-2 py-2">Vai trò hệ thống</th>
                    <th className="px-2 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {candidateUsers.map((item) => (
                    <tr key={item.user_id} className="border-b">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedCandidateIds.includes(item.user_id)}
                          disabled={item.is_in_team || !item.is_active}
                          onChange={(event) =>
                            toggleCandidate(item.user_id, event.target.checked)
                          }
                        />
                      </td>
                      <td className="px-2 py-2">{item.email}</td>
                      <td className="px-2 py-2">{item.full_name}</td>
                      <td className="px-2 py-2">
                        {item.roles.join(", ") || "-"}
                      </td>
                      <td className="px-2 py-2">
                        {item.is_in_team ? (
                          <span className="text-xs text-amber-600">
                            Đã ở trong team
                          </span>
                        ) : !item.is_active ? (
                          <span className="text-xs text-destructive">
                            Tài khoản đang bị khóa
                          </span>
                        ) : (
                          <span className="text-xs text-emerald-600">
                            Có thể thêm
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {candidateLoading ? (
              <p className="text-sm text-muted-foreground">
                Đang tìm kiếm nhân viên...
              </p>
            ) : null}
            {candidateUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Không tìm thấy nhân viên phù hợp trong tenant theo từ khóa hiện
                tại.
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => void handleInviteMembers()}
              disabled={!isTeamManager || submittingInvite}
            >
              Thêm vào team ({selectedCandidateIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createTeamDialogOpen}
        onOpenChange={setCreateTeamDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo workspace team</DialogTitle>
            <DialogDescription>
              Team sẽ dùng để quản lý nhân viên và phân quyền trong workspace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="newTeamName">Tên team</Label>
              <Input
                id="newTeamName"
                value={newTeamName}
                onChange={(event) => setNewTeamName(event.target.value)}
                placeholder="Ví dụ: Team Vận hành"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newTeamDescription">Mô tả (không bắt buộc)</Label>
              <Input
                id="newTeamDescription"
                value={newTeamDescription}
                onChange={(event) => setNewTeamDescription(event.target.value)}
                placeholder="Mô tả ngắn cho team"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateTeamDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateTeam()}
              disabled={creatingTeam}
            >
              Tạo team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
