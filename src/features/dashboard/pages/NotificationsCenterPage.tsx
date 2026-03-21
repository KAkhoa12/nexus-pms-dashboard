import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Clock4, Megaphone, Plus } from "lucide-react";
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
import { connectCollaborationRealtimeSocket } from "@/features/dashboard/api/collaboration-realtime.api";
import {
  type CreateNotificationPayload,
  type NotificationItem,
  notificationsApi,
} from "@/features/dashboard/api/notifications.api";
import { teamsApi } from "@/features/teams";
import { usersApi } from "@/features/users/api/users.api";
import { hasAnyPermission } from "@/services/auth/permissions";
import { storage } from "@/services/storage";
import { useAuthStore } from "@/store/auth.store";

const WORKSPACE_KEY = "active_workspace_key";

type RecipientOption = {
  user_id: number;
  full_name: string;
  email: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function formatPublishedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN");
}

export function NotificationsCenterPage() {
  const permissions = useAuthStore((state) => state.permissions);
  const preferences = useAuthStore((state) => state.preferences);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [creatingNotification, setCreatingNotification] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>(
    [],
  );
  const [notificationTitle, setNotificationTitle] = useState("");
  const [notificationBody, setNotificationBody] = useState("");
  const [notificationType, setNotificationType] = useState<
    "ALL_USERS" | "SELECTED_USERS" | "SYSTEM"
  >("ALL_USERS");
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>(
    [],
  );
  const [isLimitToTeam, setIsLimitToTeam] = useState(true);

  const workspaceKey =
    preferences?.workspaceKey || storage.get(WORKSPACE_KEY) || "personal";
  const currentTeamId = useMemo(() => {
    if (!workspaceKey.startsWith("team:")) return null;
    const raw = workspaceKey.split(":", 2)[1];
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [workspaceKey]);

  const canCreateNotification = hasAnyPermission(permissions, [
    "notifications:create",
    "collaboration:notifications:create",
    "user:mangage",
    "platform:developer:access",
  ]);

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  async function fetchNotifications() {
    setLoadingNotifications(true);
    try {
      const items = await notificationsApi.list();
      setNotifications(items);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách thông báo."));
      setNotifications([]);
    } finally {
      setLoadingNotifications(false);
    }
  }

  async function fetchRecipientOptions() {
    if (!canCreateNotification) return;
    try {
      const users = await usersApi.list("active");
      setRecipientOptions(
        users.map((item) => ({
          user_id: item.id,
          full_name: item.full_name,
          email: item.email,
        })),
      );
      return;
    } catch {
      // fallback to team users
    }

    try {
      const teams = await teamsApi.getMyTeams();
      const allMembers = teams.flatMap((team) => team.members);
      const dedup = new Map<number, RecipientOption>();
      allMembers.forEach((member) => {
        dedup.set(member.user_id, {
          user_id: member.user_id,
          full_name: member.full_name,
          email: member.email,
        });
      });
      setRecipientOptions(Array.from(dedup.values()));
    } catch {
      setRecipientOptions([]);
    }
  }

  useEffect(() => {
    void fetchNotifications();
    if (wsConnected) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void fetchNotifications();
    }, 10000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [wsConnected]);

  useEffect(() => {
    const socket = connectCollaborationRealtimeSocket({
      workspaceKey,
      onConnectedChange: (connected) => {
        setWsConnected(connected);
      },
      onEvent: (event) => {
        const eventType = String(event.type || "").toLowerCase();
        if (eventType === "notification") {
          void fetchNotifications();
        }
      },
    });

    return () => {
      socket.close();
      setWsConnected(false);
    };
  }, [workspaceKey]);

  useEffect(() => {
    void fetchRecipientOptions();
  }, [canCreateNotification]);

  async function handleMarkRead(notificationId: number) {
    try {
      const updated = await notificationsApi.markRead(notificationId);
      setNotifications((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể cập nhật trạng thái đã đọc."),
      );
    }
  }

  async function handleMarkAllRead() {
    const unread = notifications.filter((item) => !item.is_read);
    if (unread.length === 0) {
      toast.message("Không có thông báo chưa đọc.");
      return;
    }
    await Promise.allSettled(
      unread.map((item) => notificationsApi.markRead(item.id)),
    );
    await fetchNotifications();
    toast.success("Đã đánh dấu đã đọc tất cả.");
  }

  async function handleCreateNotification() {
    const title = notificationTitle.trim();
    const body = notificationBody.trim();
    if (title.length < 2 || body.length < 2) {
      toast.error("Tiêu đề và nội dung phải có ít nhất 2 ký tự.");
      return;
    }

    const payload: CreateNotificationPayload = {
      title,
      body,
      notification_type: notificationType,
      team_id: isLimitToTeam ? currentTeamId : null,
      recipient_user_ids:
        notificationType === "SELECTED_USERS" ? selectedRecipientIds : [],
    };

    if (
      notificationType === "SELECTED_USERS" &&
      selectedRecipientIds.length === 0
    ) {
      toast.error("Hãy chọn ít nhất 1 người nhận.");
      return;
    }

    setCreatingNotification(true);
    try {
      await notificationsApi.create(payload);
      setIsCreateDialogOpen(false);
      setNotificationTitle("");
      setNotificationBody("");
      setSelectedRecipientIds([]);
      await fetchNotifications();
      toast.success("Đã tạo thông báo mới.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tạo thông báo."));
    } finally {
      setCreatingNotification(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Bell className="h-5 w-5 text-primary" />
            Trung tâm thông báo
          </h1>
          <p className="text-sm text-muted-foreground">
            Nhận thông báo hệ thống và thông báo gửi theo người dùng/team.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateNotification ? (
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Tạo thông báo
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => void handleMarkAllRead()}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Đánh dấu đã đọc tất cả ({unreadCount})
          </Button>
        </div>
      </div>

      {loadingNotifications ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Đang tải danh sách thông báo...
          </CardContent>
        </Card>
      ) : null}

      {!loadingNotifications && notifications.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Chưa có thông báo nào.
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {notifications.map((item) => (
          <Card
            key={item.id}
            className={!item.is_read ? "border-primary/40" : ""}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4 text-primary" />
                  {item.title}
                  {!item.is_read ? (
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      Mới
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <Clock4 className="h-3.5 w-3.5" />
                  {formatPublishedAt(item.published_at)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{item.body}</p>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Type: {item.notification_type} | Team: {item.team_id ?? "-"}
                </span>
                {!item.is_read ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleMarkRead(item.id)}
                  >
                    Đánh dấu đã đọc
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo thông báo mới</DialogTitle>
            <DialogDescription>
              Gửi cho toàn hệ thống, hoặc chọn 1/nhiều người nhận cụ thể.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tiêu đề</label>
              <Input
                value={notificationTitle}
                onChange={(event) => setNotificationTitle(event.target.value)}
                placeholder="Ví dụ: Nhắc nộp báo cáo tuần"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nội dung</label>
              <Input
                value={notificationBody}
                onChange={(event) => setNotificationBody(event.target.value)}
                placeholder="Nội dung thông báo..."
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Loại thông báo</label>
              <select
                value={notificationType}
                onChange={(event) =>
                  setNotificationType(
                    event.target.value as
                      | "ALL_USERS"
                      | "SELECTED_USERS"
                      | "SYSTEM",
                  )
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ALL_USERS">ALL_USERS (toàn hệ thống)</option>
                <option value="SELECTED_USERS">
                  SELECTED_USERS (chọn người nhận)
                </option>
                <option value="SYSTEM">SYSTEM</option>
              </select>
            </div>

            {currentTeamId ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isLimitToTeam}
                  onChange={(event) => setIsLimitToTeam(event.target.checked)}
                />
                Giới hạn trong team hiện tại (team_id: {currentTeamId})
              </label>
            ) : null}

            {notificationType === "SELECTED_USERS" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Chọn người nhận</p>
                <div className="max-h-52 space-y-2 overflow-y-auto rounded-md border border-border/60 p-3">
                  {recipientOptions.map((item) => {
                    const checked = selectedRecipientIds.includes(item.user_id);
                    return (
                      <label
                        key={item.user_id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const nextChecked = event.target.checked;
                            setSelectedRecipientIds((previous) => {
                              if (nextChecked) {
                                return Array.from(
                                  new Set([...previous, item.user_id]),
                                );
                              }
                              return previous.filter(
                                (id) => id !== item.user_id,
                              );
                            });
                          }}
                        />
                        <span>{item.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.email}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={() => void handleCreateNotification()}
              disabled={creatingNotification}
            >
              {creatingNotification ? "Đang gửi..." : "Gửi thông báo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
