import {
  type ComponentType,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BarChart3,
  BadgeInfo,
  Bell,
  Bot,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderTree,
  Handshake,
  Home,
  KeyRound,
  Lock,
  Map,
  MessageCircle,
  Palette,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SunMoon,
  Trash2,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  connectCollaborationRealtimeSocket,
  type CollaborationRealtimeEvent,
} from "@/features/dashboard/api/collaboration-realtime.api";
import {
  notificationsApi,
  type NotificationItem,
} from "@/features/dashboard/api/notifications.api";
import {
  teamChatApi,
  type ChatChannel,
} from "@/features/dashboard/api/team-chat.api";
import { authApi } from "@/features/auth/api/auth.api";
import { teamsApi } from "@/features/teams";
import type { Team } from "@/features/teams";
import { hasAnyPermission } from "@/services/auth/permissions";
import { storage } from "@/services/storage";
import { useAuthStore } from "@/store/auth.store";
import { useThemeMode } from "@/shared/hooks/useThemeMode";
import type { ThemeMode } from "@/store/ui.store";

const WORKSPACE_KEY = "active_workspace_key";
const HEADER_PREVIEW_LIMIT = 6;

type GlobalSearchItem = {
  key: string;
  label: string;
  path: string;
  keywords: string[];
  isEnabled: boolean;
};

function getPublicAssetUrl(fileName: string): string {
  const baseUrl = import.meta.env.BASE_URL || "/";
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${fileName}`.replace(/([^:]\/)\/+/g, "$1");
}

type HeaderChatPreviewItem = {
  channel: ChatChannel;
};

function formatDateTimeDisplay(value: string | null): string {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SidebarGroupProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  compact?: boolean;
  children: ReactNode;
};

function SidebarGroup({
  label,
  icon: Icon,
  defaultOpen = false,
  compact = false,
  children,
}: SidebarGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="space-y-2">
      <button
        type="button"
        title={label}
        className={`flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-medium text-foreground hover:bg-muted ${
          compact ? "justify-center gap-0" : "gap-2"
        }`}
        onClick={() => {
          if (!compact) setIsOpen((prev) => !prev);
        }}
      >
        <Icon className="h-4 w-4 text-muted-foreground" />
        {!compact ? <span className="flex-1">{label}</span> : null}
        {!compact ? (
          isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        ) : null}
      </button>

      {!compact && isOpen ? (
        <div className="ml-6 space-y-1">{children}</div>
      ) : null}
    </div>
  );
}

function SidebarSectionLabel({
  label,
  icon: Icon,
  compact = false,
}: {
  label: string;
  icon: ComponentType<{ className?: string }>;
  compact?: boolean;
}) {
  return (
    <div
      title={label}
      className={`mb-2 flex items-center px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
        compact ? "justify-center gap-0" : "gap-2"
      }`}
    >
      <Icon className="h-4 w-4" />
      {!compact ? <span>{label}</span> : null}
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  compact = false,
  disabled = false,
}: {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  compact?: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div
        title={`${label} (không có quyền xem)`}
        aria-disabled="true"
        className={`relative flex w-full cursor-not-allowed items-center rounded-md px-2 py-1.5 text-left text-sm font-medium text-muted-foreground/70 ${
          compact ? "justify-center gap-0" : "gap-2"
        } border border-dashed border-border/60 bg-muted/30`}
      >
        <Icon className="h-4 w-4" />
        {!compact ? <span>{label}</span> : null}
        <span className="absolute -right-1 -top-1 rounded-full border border-border bg-background p-0.5">
          <Lock className="h-2.5 w-2.5 text-amber-600" />
        </span>
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      end={to === "/dashboard"}
      title={label}
      className={({ isActive }) =>
        `flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-medium ${
          compact ? "justify-center gap-0" : "gap-2"
        } ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-muted"
        }`
      }
    >
      <Icon className="h-4 w-4" />
      {!compact ? <span>{label}</span> : null}
    </NavLink>
  );
}

export function AppLayout() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions);
  const subscription = useAuthStore((state) => state.subscription);
  const preferences = useAuthStore((state) => state.preferences);
  const setPreferences = useAuthStore((state) => state.setPreferences);
  const isBusinessPackage = subscription?.packageCode === "BUSINESS";
  const canCreateWorkspaceTeam =
    subscription?.packageCode === "BUSINESS" &&
    subscription?.packageSource === "personal";
  const { mode, setMode } = useThemeMode();
  const canUseSunsetTheme = subscription?.canUseSunsetTheme ?? false;
  const canUseAuroraTheme = Boolean(
    subscription?.featureCodes.includes("PRO_AURORA_THEME"),
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isAiSheetOpen, setIsAiSheetOpen] = useState(false);
  const [aiQuickPrompt, setAiQuickPrompt] = useState("");
  const [workspaceTeams, setWorkspaceTeams] = useState<Team[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [workspacePreferenceHydrated, setWorkspacePreferenceHydrated] =
    useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isDeleteWorkspaceOpen, setIsDeleteWorkspaceOpen] = useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Team | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("");
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [deletingWorkspace, setDeletingWorkspace] = useState(false);
  const [activeWorkspaceKey, setActiveWorkspaceKey] = useState<string>(
    () => storage.get(WORKSPACE_KEY) || "personal",
  );
  const isPersonalWorkspace = activeWorkspaceKey === "personal";
  const canUseBusinessWorkspaceFeatures =
    isBusinessPackage && !isPersonalWorkspace;
  const activeTeamId = activeWorkspaceKey.startsWith("team:")
    ? Number(activeWorkspaceKey.split(":", 2)[1] || 0)
    : null;
  const [headerNotifications, setHeaderNotifications] = useState<
    NotificationItem[]
  >([]);
  const [headerChatPreview, setHeaderChatPreview] = useState<
    HeaderChatPreviewItem[]
  >([]);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [isChatPreviewLoading, setIsChatPreviewLoading] = useState(false);
  const [isNotificationsMenuOpen, setIsNotificationsMenuOpen] = useState(false);
  const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatAudioRef = useRef<HTMLAudioElement | null>(null);
  const soundUnlockedRef = useRef(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const globalSearchRef = useRef<HTMLDivElement | null>(null);

  const isSidebarCompact = isSidebarCollapsed && !isSidebarHovered;
  const appVersion = import.meta.env.VITE_APP_VERSION || "2026.03";
  const accountName = user?.fullName || "Tài khoản";
  const accountEmail = user?.email || "Chưa có email";
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "U";
  const activeWorkspaceTeam = activeWorkspaceKey.startsWith("team:")
    ? workspaceTeams.find((item) => `team:${item.id}` === activeWorkspaceKey) ||
      null
    : null;
  const activeWorkspaceLabel = activeWorkspaceTeam
    ? activeWorkspaceTeam.name
    : "Personal";
  const activeWorkspaceHint = activeWorkspaceTeam
    ? `${activeWorkspaceTeam.members.length} thành viên`
    : "Không gian cá nhân";
  const unreadNotificationCount = useMemo(
    () => headerNotifications.filter((item) => !item.is_read).length,
    [headerNotifications],
  );
  const unreadChatCount = useMemo(
    () =>
      headerChatPreview.reduce(
        (total, item) =>
          total + Math.max(0, Number(item.channel.unread_count || 0)),
        0,
      ),
    [headerChatPreview],
  );

  const themeOptions: Array<{
    value: ThemeMode;
    label: string;
    description: string;
    isEnabled: boolean;
  }> = [
    {
      value: "light",
      label: "Light",
      description: "Sáng rõ, dễ nhìn cho làm việc ban ngày.",
      isEnabled: true,
    },
    {
      value: "dark",
      label: "Dark",
      description: "Tối hiện đại, giảm chói khi làm việc đêm.",
      isEnabled: true,
    },
    {
      value: "sunset",
      label: "Sunset Mint",
      description: "Gói Pro/Business - tông ấm và xanh mint.",
      isEnabled: canUseSunsetTheme,
    },
    {
      value: "aurora",
      label: "Aurora Pro",
      description: "Gói Pro/Business - lấy cảm hứng từ landing Pro.",
      isEnabled: canUseAuroraTheme,
    },
  ];

  const playNotificationSound = () => {
    const audio = notificationAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };

  const playChatSound = () => {
    const audio = chatAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  };

  const unlockSoundPlayback = () => {
    if (soundUnlockedRef.current) return;
    const audios = [notificationAudioRef.current, chatAudioRef.current].filter(
      (item): item is HTMLAudioElement => item !== null,
    );
    if (audios.length === 0) return;

    audios.forEach((audio) => {
      audio.muted = true;
      audio.currentTime = 0;
      void audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => undefined);
    });
    soundUnlockedRef.current = true;
  };

  async function loadHeaderNotifications() {
    if (!canUseBusinessWorkspaceFeatures) {
      setHeaderNotifications([]);
      return;
    }

    setIsNotificationsLoading(true);
    try {
      const items = await notificationsApi.list();
      const filtered = items.filter((item) => {
        if (!activeTeamId) return true;
        return item.team_id === null || item.team_id === activeTeamId;
      });
      setHeaderNotifications(filtered.slice(0, HEADER_PREVIEW_LIMIT));
    } catch {
      setHeaderNotifications([]);
    } finally {
      setIsNotificationsLoading(false);
    }
  }

  async function loadHeaderChatPreview() {
    if (!canUseBusinessWorkspaceFeatures || !activeTeamId) {
      setHeaderChatPreview([]);
      return;
    }

    setIsChatPreviewLoading(true);
    try {
      const channels = await teamChatApi.listChannels();
      const scopedChannels = channels
        .filter(
          (channel) =>
            channel.is_active &&
            channel.team_id === activeTeamId &&
            (channel.is_group || channel.member_user_ids.length > 0),
        )
        .sort((a, b) => {
          const unreadDiff =
            Number(b.unread_count || 0) - Number(a.unread_count || 0);
          if (unreadDiff !== 0) return unreadDiff;
          const left = new Date(a.last_message_at || a.created_at).getTime();
          const right = new Date(b.last_message_at || b.created_at).getTime();
          return right - left;
        })
        .slice(0, HEADER_PREVIEW_LIMIT);
      setHeaderChatPreview(scopedChannels.map((channel) => ({ channel })));
    } catch {
      setHeaderChatPreview([]);
    } finally {
      setIsChatPreviewLoading(false);
    }
  }

  async function handleMarkNotificationRead(notificationId: number) {
    try {
      const updated = await notificationsApi.markRead(notificationId);
      setHeaderNotifications((previous) =>
        previous.map((item) =>
          item.id === notificationId
            ? { ...item, is_read: true, read_at: updated.read_at }
            : item,
        ),
      );
    } catch {
      toast.error("Không thể đánh dấu đã đọc.");
    }
  }

  useEffect(() => {
    if (!user?.id) {
      setWorkspaceTeams([]);
      setWorkspaceReady(false);
      setWorkspacePreferenceHydrated(false);
      return;
    }
    setWorkspacePreferenceHydrated(false);
    let mounted = true;
    setWorkspaceReady(false);
    setWorkspaceLoading(true);
    teamsApi
      .getMyTeams()
      .then((items) => {
        if (!mounted) return;
        setWorkspaceTeams(items);
      })
      .catch(() => {
        if (!mounted) return;
        setWorkspaceTeams([]);
      })
      .finally(() => {
        if (mounted) {
          setWorkspaceLoading(false);
          setWorkspaceReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (workspacePreferenceHydrated) return;
    const preferredKey = preferences?.workspaceKey;
    if (!preferredKey) {
      setWorkspacePreferenceHydrated(true);
      return;
    }
    setActiveWorkspaceKey(preferredKey);
    storage.set(WORKSPACE_KEY, preferredKey);
    setWorkspacePreferenceHydrated(true);
  }, [preferences?.workspaceKey, workspacePreferenceHydrated]);

  useEffect(() => {
    if (!workspaceReady) return;
    const validKeys = new Set([
      "personal",
      ...workspaceTeams.map((item) => `team:${item.id}`),
    ]);
    if (!validKeys.has(activeWorkspaceKey)) {
      setActiveWorkspaceKey("personal");
      storage.set(WORKSPACE_KEY, "personal");
    }
  }, [activeWorkspaceKey, workspaceReady, workspaceTeams]);

  useEffect(() => {
    notificationAudioRef.current = new Audio(
      getPublicAssetUrl("notification.mp3"),
    );
    notificationAudioRef.current.preload = "auto";
    notificationAudioRef.current.volume = 1;
    chatAudioRef.current = new Audio(getPublicAssetUrl("chat-messenger.mp3"));
    chatAudioRef.current.preload = "auto";
    chatAudioRef.current.volume = 1;
    const unlockHandler = () => {
      unlockSoundPlayback();
    };
    window.addEventListener("pointerdown", unlockHandler, { passive: true });
    window.addEventListener("keydown", unlockHandler);
    return () => {
      window.removeEventListener("pointerdown", unlockHandler);
      window.removeEventListener("keydown", unlockHandler);
      notificationAudioRef.current = null;
      chatAudioRef.current = null;
      soundUnlockedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!canUseBusinessWorkspaceFeatures) {
      setHeaderNotifications([]);
      setHeaderChatPreview([]);
      setIsNotificationsMenuOpen(false);
      setIsChatMenuOpen(false);
      setIsAiSheetOpen(false);
      return;
    }
    void loadHeaderNotifications();
    void loadHeaderChatPreview();
  }, [canUseBusinessWorkspaceFeatures, activeWorkspaceKey]);

  useEffect(() => {
    if (!canUseBusinessWorkspaceFeatures) return;
    if (!isNotificationsMenuOpen) return;
    void loadHeaderNotifications();
  }, [canUseBusinessWorkspaceFeatures, isNotificationsMenuOpen]);

  useEffect(() => {
    if (!canUseBusinessWorkspaceFeatures) return;
    if (!isChatMenuOpen) return;
    void loadHeaderChatPreview();
  }, [canUseBusinessWorkspaceFeatures, isChatMenuOpen]);

  useEffect(() => {
    if (!canUseBusinessWorkspaceFeatures || !user?.id) return;
    const allowNotifications = hasAnyPermission(permissions, [
      "collaboration:notifications:view",
      "notifications:create",
      "collaboration:notifications:create",
      "user:mangage",
    ]);
    const allowChat = hasAnyPermission(permissions, [
      "collaboration:chat:view",
      "collaboration:chat:message:send",
      "user:mangage",
    ]);

    const socket = connectCollaborationRealtimeSocket({
      workspaceKey: activeWorkspaceKey,
      onEvent: (event: CollaborationRealtimeEvent) => {
        if (event.type === "notification") {
          if (!allowNotifications) {
            return;
          }
          const targetUserId = Number(event.payload?.user_id || 0);
          if (targetUserId === user.id) {
            playNotificationSound();
            void loadHeaderNotifications();
          }
          return;
        }

        if (event.type === "chat_message") {
          if (!allowChat) {
            return;
          }
          const senderId = Number(event.payload?.sender_user_id || 0);
          if (senderId > 0 && senderId !== user.id) {
            playChatSound();
          }
          void loadHeaderChatPreview();
        }
      },
    });

    return () => {
      socket.close();
    };
  }, [
    canUseBusinessWorkspaceFeatures,
    activeWorkspaceKey,
    user?.id,
    permissions,
  ]);

  function selectWorkspace(key: string): void {
    setActiveWorkspaceKey(key);
    storage.set(WORKSPACE_KEY, key);
    setWorkspacePreferenceHydrated(true);
    navigate("/dashboard", { replace: true });

    void authApi
      .updatePreferences({ workspace_key: key })
      .then((response) => {
        setPreferences({ workspaceKey: response.workspace_key });
        return fetchMe();
      })
      .catch(() => {
        toast.error("Không thể lưu workspace mặc định.");
        return fetchMe();
      })
      .catch(() => {
        toast.error("Không thể đồng bộ quyền theo workspace mới.");
      });
  }

  function handleThemeSelect(theme: ThemeMode): void {
    setMode(theme);
    void authApi
      .updatePreferences({ theme_mode: theme })
      .then((response) => {
        setPreferences({ themeMode: response.theme_mode });
      })
      .catch(() => {
        toast.error("Không thể lưu theme mặc định.");
      });
  }

  async function handleCreateWorkspaceTeam() {
    if (!canCreateWorkspaceTeam) {
      toast.error("Chỉ tài khoản gói Business cá nhân mới tạo được workspace.");
      return;
    }

    const normalizedName = newWorkspaceName.trim();
    if (normalizedName.length < 2) {
      toast.error("Tên workspace team cần ít nhất 2 ký tự.");
      return;
    }

    setCreatingWorkspace(true);
    try {
      const createdTeam = await teamsApi.createTeam({
        name: normalizedName,
        description: newWorkspaceDescription.trim() || undefined,
      });
      const refreshedTeams = await teamsApi.getMyTeams();
      setWorkspaceTeams(refreshedTeams);

      const workspaceKey = `team:${createdTeam.id}`;
      setActiveWorkspaceKey(workspaceKey);
      storage.set(WORKSPACE_KEY, workspaceKey);
      setWorkspacePreferenceHydrated(true);
      void authApi
        .updatePreferences({ workspace_key: workspaceKey })
        .then((response) => {
          setPreferences({ workspaceKey: response.workspace_key });
          return fetchMe();
        })
        .catch(() => {
          toast.error("Không thể lưu workspace mặc định.");
          return fetchMe();
        })
        .catch(() => {
          toast.error("Không thể đồng bộ quyền theo workspace mới.");
        });

      setIsCreateWorkspaceOpen(false);
      setNewWorkspaceName("");
      setNewWorkspaceDescription("");
      toast.success("Đã tạo workspace team mới.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể tạo workspace team.";
      toast.error(message);
    } finally {
      setCreatingWorkspace(false);
    }
  }

  async function handleDeleteWorkspaceTeam() {
    if (!workspaceToDelete) {
      return;
    }
    setDeletingWorkspace(true);
    try {
      await teamsApi.deleteTeam(workspaceToDelete.id);
      const nextTeams = await teamsApi.getMyTeams();
      setWorkspaceTeams(nextTeams);
      const removedKey = `team:${workspaceToDelete.id}`;
      if (activeWorkspaceKey === removedKey) {
        selectWorkspace("personal");
      } else {
        void fetchMe().catch(() => undefined);
      }
      setIsDeleteWorkspaceOpen(false);
      setWorkspaceToDelete(null);
      toast.success("Đã xóa workspace team.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Không thể xóa workspace team.";
      toast.error(message);
    } finally {
      setDeletingWorkspace(false);
    }
  }

  const canViewBranches = hasAnyPermission(permissions, [
    "branches:view",
    "branch:view",
    "user:mangage",
  ]);
  const canViewAreas = hasAnyPermission(permissions, [
    "areas:view",
    "area:view",
    "user:mangage",
  ]);
  const canViewBuildings = hasAnyPermission(permissions, [
    "buildings:view",
    "building:view",
    "user:mangage",
  ]);
  const canViewRooms = hasAnyPermission(permissions, [
    "rooms:view",
    "room:view",
    "user:mangage",
  ]);
  const canViewRoomTypes = hasAnyPermission(permissions, [
    "room_types:view",
    "room_type:view",
    "user:mangage",
  ]);
  const canViewRenters = hasAnyPermission(permissions, [
    "renters:view",
    "renter:view",
    "user:mangage",
  ]);
  const canViewRenterMembers = hasAnyPermission(permissions, [
    "renter_members:view",
    "renter_member:view",
    "user:mangage",
  ]);
  const canViewCustomers = canViewRenters || canViewRenterMembers;
  const canViewContracts = hasAnyPermission(permissions, [
    "leases:view",
    "lease:view",
    "leases:create",
    "lease:create",
    "leases:manage",
    "user:mangage",
  ]);
  const canViewCustomerAppointments = hasAnyPermission(permissions, [
    "customer_appointments:view",
    "customer_appointment:view",
    "user:mangage",
  ]);
  const canViewServiceFees = hasAnyPermission(permissions, [
    "service_fees:view",
    "service_fee:view",
    "user:mangage",
  ]);
  const canViewMaterialsAssets = hasAnyPermission(permissions, [
    "materials_assets:view",
    "materials_asset:view",
    "user:mangage",
  ]);
  const canViewMaterialsAssetTypes = hasAnyPermission(permissions, [
    "materials_asset_types:view",
    "materials_assets:view",
    "user:mangage",
  ]);
  const canViewRoomAssets = canViewRooms && canViewMaterialsAssets;
  const canViewInvoices = hasAnyPermission(permissions, [
    "invoices:view",
    "invoice:view",
    "user:mangage",
  ]);
  const canViewForms = hasAnyPermission(permissions, [
    "form_templates:view",
    "user:mangage",
  ]);
  const canViewUsers = hasAnyPermission(permissions, [
    "users:view",
    "user:view",
    "user:mangage",
  ]);
  const canManageUserPermissions = hasAnyPermission(permissions, [
    "users:permissions:manage",
    "users:permissions:create",
    "users:permissions:update",
    "users:permissions:delete",
    "user:permision:view",
    "user:mangage",
  ]);
  const canViewBusinessNotifications = hasAnyPermission(permissions, [
    "collaboration:notifications:view",
    "notifications:create",
    "collaboration:notifications:create",
    "user:mangage",
  ]);
  const canViewBusinessChat = hasAnyPermission(permissions, [
    "collaboration:chat:view",
    "collaboration:chat:message:send",
    "user:mangage",
  ]);
  const canViewBusinessAi = hasAnyPermission(permissions, [
    "collaboration:ai:sessions:view",
    "collaboration:ai:messages:create",
    "user:mangage",
  ]);
  const canViewOperations =
    canViewBranches ||
    canViewAreas ||
    canViewBuildings ||
    canViewRooms ||
    canViewRoomTypes ||
    canViewRenters ||
    canViewRenterMembers ||
    canViewContracts ||
    canViewCustomerAppointments ||
    canViewServiceFees ||
    canViewMaterialsAssetTypes ||
    canViewMaterialsAssets ||
    canViewInvoices;
  const canViewReports = hasAnyPermission(permissions, ["user:mangage"]);

  const globalSearchItems = useMemo<GlobalSearchItem[]>(
    () => [
      {
        key: "dashboard-overview",
        label: "Tổng quan",
        path: "/dashboard",
        keywords: ["tong quan", "dashboard", "overview"],
        isEnabled: true,
      },
      {
        key: "apartment-map",
        label: "Sơ đồ căn hộ",
        path: "/dashboard/apartment-map",
        keywords: ["so do", "can ho", "map", "apartment"],
        isEnabled: true,
      },
      {
        key: "branches",
        label: "Quản lý chi nhánh",
        path: "/dashboard/branches",
        keywords: ["chi nhanh", "branch"],
        isEnabled: canViewBranches,
      },
      {
        key: "areas",
        label: "Quản lý khu vực",
        path: "/dashboard/areas",
        keywords: ["khu vuc", "area"],
        isEnabled: canViewAreas,
      },
      {
        key: "buildings",
        label: "Quản lý tòa nhà",
        path: "/dashboard/buildings",
        keywords: ["toa nha", "building"],
        isEnabled: canViewBuildings,
      },
      {
        key: "rooms",
        label: "Quản lý phòng",
        path: "/dashboard/rooms",
        keywords: ["phong", "room"],
        isEnabled: canViewRooms,
      },
      {
        key: "room-types",
        label: "Quản lý loại phòng",
        path: "/dashboard/room-types",
        keywords: ["loai phong", "room type"],
        isEnabled: canViewRoomTypes,
      },
      {
        key: "service-fees",
        label: "Quản lý phí thu",
        path: "/dashboard/service-fees",
        keywords: ["phi thu", "dien", "nuoc", "bai do xe", "camera"],
        isEnabled: canViewServiceFees,
      },
      {
        key: "customer-appointments",
        label: "Khách hẹn",
        path: "/dashboard/customer-appointments",
        keywords: ["khach hen", "lich hen", "appointment"],
        isEnabled: canViewCustomerAppointments,
      },
      {
        key: "customers",
        label: "Khách hàng",
        path: "/dashboard/customers",
        keywords: ["khach hang", "khach thue", "renter", "member"],
        isEnabled: canViewCustomers,
      },
      {
        key: "contracts",
        label: "Hợp đồng",
        path: "/dashboard/contracts",
        keywords: ["hop dong", "lease", "contract", "thue phong"],
        isEnabled: canViewContracts,
      },
      {
        key: "materials-asset-types",
        label: "Quản lý vật tư",
        path: "/dashboard/materials-asset-types",
        keywords: [
          "loai vat tu",
          "loai tai san",
          "asset type",
          "materials type",
        ],
        isEnabled: canViewMaterialsAssetTypes,
      },
      {
        key: "materials-assets",
        label: "Quản lý vật tư",
        path: "/dashboard/materials-assets",
        keywords: [
          "tai san",
          "vat tu",
          "xe may",
          "xe hoi",
          "asset",
          "material",
        ],
        isEnabled: canViewMaterialsAssets,
      },
      {
        key: "room-assets",
        label: "Quản lý tài sản phòng",
        path: "/dashboard/room-assets",
        keywords: ["tai san phong", "vat tu phong", "room assets"],
        isEnabled: canViewRoomAssets,
      },
      {
        key: "invoices",
        label: "Quản lý hóa đơn",
        path: "/dashboard/invoices",
        keywords: ["hoa don", "invoice"],
        isEnabled: canViewInvoices,
      },
      {
        key: "forms",
        label: "Biểu mẫu",
        path: "/dashboard/settings/forms",
        keywords: ["bieu mau", "form"],
        isEnabled: canViewForms,
      },
      {
        key: "users",
        label: "Nhân viên",
        path: "/dashboard/users",
        keywords: ["nhan vien", "user", "employee"],
        isEnabled: canUseBusinessWorkspaceFeatures && canViewUsers,
      },
      {
        key: "permissions",
        label: "Quản lý quyền",
        path: "/dashboard/permision",
        keywords: ["quyen", "phan quyen", "permission", "rbac"],
        isEnabled: canUseBusinessWorkspaceFeatures && canManageUserPermissions,
      },
      {
        key: "notifications",
        label: "Thông báo",
        path: "/dashboard/notifications",
        keywords: ["thong bao", "notification"],
        isEnabled:
          canUseBusinessWorkspaceFeatures && canViewBusinessNotifications,
      },
      {
        key: "team-chat",
        label: "Chat Team",
        path: "/dashboard/team-chat",
        keywords: ["chat", "team chat", "nhan tin noi bo"],
        isEnabled: canUseBusinessWorkspaceFeatures && canViewBusinessChat,
      },
      {
        key: "ai-assistant",
        label: "AI Công việc",
        path: "/dashboard/ai-assistant",
        keywords: ["ai", "tro ly", "cong viec", "chatbot"],
        isEnabled: canUseBusinessWorkspaceFeatures && canViewBusinessAi,
      },
    ],
    [
      canManageUserPermissions,
      canUseBusinessWorkspaceFeatures,
      canViewAreas,
      canViewBranches,
      canViewBuildings,
      canViewBusinessAi,
      canViewBusinessChat,
      canViewBusinessNotifications,
      canViewCustomerAppointments,
      canViewCustomers,
      canViewContracts,
      canViewForms,
      canViewInvoices,
      canViewMaterialsAssetTypes,
      canViewMaterialsAssets,
      canViewRoomAssets,
      canViewRoomTypes,
      canViewRooms,
      canViewServiceFees,
      canViewUsers,
    ],
  );

  const globalSearchResults = useMemo(() => {
    const normalizedQuery = globalSearchQuery.trim().toLowerCase();
    const base = normalizedQuery
      ? globalSearchItems.filter((item) => {
          const searchable =
            `${item.label} ${item.path} ${item.keywords.join(" ")}`.toLowerCase();
          return normalizedQuery
            .split(/\s+/)
            .every((token) => searchable.includes(token));
        })
      : globalSearchItems;
    return [...base]
      .sort((left, right) => Number(right.isEnabled) - Number(left.isEnabled))
      .slice(0, 10);
  }, [globalSearchItems, globalSearchQuery]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!globalSearchRef.current) return;
      if (globalSearchRef.current.contains(event.target as Node)) return;
      setIsGlobalSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleOpenGlobalSearchItem(item: GlobalSearchItem): void {
    if (!item.isEnabled) {
      toast.error("Bạn chưa có quyền truy cập chức năng này.");
      return;
    }
    setIsGlobalSearchOpen(false);
    setGlobalSearchQuery("");
    navigate(item.path);
  }

  function openAiAssistantWithPrompt(prompt?: string): void {
    if (!canViewBusinessAi) {
      toast.error("Bạn chưa có quyền sử dụng AI trợ lý.");
      return;
    }

    const normalizedPrompt = (prompt ?? aiQuickPrompt).trim();
    setIsAiSheetOpen(false);

    if (!normalizedPrompt) {
      navigate("/dashboard/ai-assistant");
      return;
    }

    const params = new URLSearchParams();
    params.set("q", normalizedPrompt);
    params.set("auto", "1");
    params.set("t", `${Date.now()}`);
    navigate(`/dashboard/ai-assistant?${params.toString()}`);
    setAiQuickPrompt("");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      <aside
        className={`border-r bg-card transition-[width] duration-200 ${
          isSidebarCompact ? "w-[80px]" : "w-[280px]"
        }`}
        onMouseEnter={() => {
          if (isSidebarCollapsed) setIsSidebarHovered(true);
        }}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="px-4 py-6">
            <div className={`${isSidebarCompact ? "flex justify-center" : ""}`}>
              <img
                src="/logo.png"
                alt="QuanLyPhongTro"
                className={`object-contain ${
                  isSidebarCompact ? "h-10 w-10 rounded-lg" : "h-12 w-auto"
                }`}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={`mt-3 h-auto  text-wrap ${
                    isSidebarCompact
                      ? "w-full justify-center px-2 py-2"
                      : "w-full justify-between px-3 py-2"
                  }`}
                  title={activeWorkspaceLabel}
                >
                  {!isSidebarCompact ? (
                    <>
                      <div className="text-left">
                        <p className="text-sm font-semibold">
                          {activeWorkspaceLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeWorkspaceHint}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </>
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="start"
                sideOffset={12}
                className="w-72"
              >
                <DropdownMenuLabel>Chọn không gian làm việc</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => selectWorkspace("personal")}>
                  <Building2 className="mr-2 h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Personal</p>
                    <p className="text-xs text-muted-foreground">
                      Làm việc bằng gói cá nhân của bạn
                    </p>
                  </div>
                  {activeWorkspaceKey === "personal" ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : null}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="p-0">Teams</DropdownMenuLabel>
                  {canCreateWorkspaceTeam ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="Tạo workspace team"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsCreateWorkspaceOpen(true);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
                {workspaceLoading ? (
                  <DropdownMenuItem disabled>
                    Đang tải danh sách team...
                  </DropdownMenuItem>
                ) : null}
                {!workspaceLoading && workspaceTeams.length === 0 ? (
                  <DropdownMenuItem disabled>
                    Chưa có team nào khả dụng
                  </DropdownMenuItem>
                ) : null}
                {!workspaceLoading
                  ? workspaceTeams.map((team) => {
                      const key = `team:${team.id}`;
                      const canDeleteTeam = team.owner_user_id === user?.id;
                      return (
                        <DropdownMenuItem
                          key={team.id}
                          onClick={() => selectWorkspace(key)}
                        >
                          <Users className="mr-2 h-4 w-4" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{team.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {team.members.length} thành viên -{" "}
                              {team.owner_package_code}
                            </p>
                          </div>
                          {activeWorkspaceKey === key ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : null}
                          {canDeleteTeam ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="ml-1 h-6 w-6 text-destructive hover:text-destructive"
                              title="Xóa workspace"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setWorkspaceToDelete(team);
                                setIsDeleteWorkspaceOpen(true);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </DropdownMenuItem>
                      );
                    })
                  : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Separator />

          <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-3 py-4">
            <NavItem
              to="/dashboard"
              label="Tổng quan"
              icon={BarChart3}
              compact={isSidebarCompact}
            />
            <NavItem
              to="/dashboard/apartment-map"
              label="Sơ đồ căn hộ"
              icon={Map}
              compact={isSidebarCompact}
            />

            <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
              <SidebarSectionLabel
                label="Vận hành"
                icon={Building2}
                compact={isSidebarCompact}
              />
              <SidebarGroup
                label="Cơ sở"
                icon={Building2}
                defaultOpen={canViewOperations}
                compact={isSidebarCompact}
              >
                <NavItem
                  to="/dashboard/branches"
                  label="Quản lý chi nhánh"
                  icon={Building2}
                  disabled={!canViewBranches}
                />
                <NavItem
                  to="/dashboard/areas"
                  label="Quản lý khu vực"
                  icon={Building2}
                  disabled={!canViewAreas}
                />
                <NavItem
                  to="/dashboard/buildings"
                  label="Quản lý tòa nhà"
                  icon={Building2}
                  disabled={!canViewBuildings}
                />
                <NavItem
                  to="/dashboard/rooms"
                  label="Quản lý phòng"
                  icon={Home}
                  disabled={!canViewRooms}
                />
                <NavItem
                  to="/dashboard/room-types"
                  label="Quản lý loại phòng"
                  icon={ClipboardList}
                  disabled={!canViewRoomTypes}
                />
              </SidebarGroup>

              <SidebarGroup
                label="Hệ thống"
                icon={FolderTree}
                defaultOpen={canViewOperations}
                compact={isSidebarCompact}
              >
                <NavItem
                  to="/dashboard/service-fees"
                  label="Quản lý phí dịch vụ"
                  icon={Wallet}
                  disabled={!canViewServiceFees}
                />
                <NavItem
                  to="/dashboard/materials-asset-types"
                  label="Quản lý vật tư"
                  icon={ClipboardList}
                  disabled={!canViewMaterialsAssetTypes}
                />
                <NavItem
                  to="/dashboard/room-assets"
                  label="Quản lý tài sản phòng"
                  icon={Home}
                  disabled={!canViewRoomAssets}
                />
              </SidebarGroup>

              <SidebarGroup
                label="Khách hàng"
                icon={Users}
                defaultOpen={canViewOperations}
                compact={isSidebarCompact}
              >
                <NavItem
                  to="/dashboard/customer-appointments"
                  label="Khách hẹn"
                  icon={Users}
                  disabled={!canViewCustomerAppointments}
                />
                <NavItem
                  to="/dashboard/contracts"
                  label="Hợp đồng"
                  icon={FileText}
                  disabled={!canViewContracts}
                />
                <NavItem
                  to="/dashboard/customers"
                  label="Khách hàng"
                  icon={Users}
                  disabled={!canViewCustomers}
                />
                <NavItem
                  to="/dashboard/materials-assets"
                  label="Quản lý vật tư"
                  icon={Building2}
                  disabled={!canViewMaterialsAssets}
                />
              </SidebarGroup>

              <SidebarGroup
                label="Tài chính"
                icon={Wallet}
                defaultOpen={canViewOperations}
                compact={isSidebarCompact}
              >
                <NavItem
                  to="/dashboard/finance-overview"
                  label="Tổng quan tài chính"
                  icon={BarChart3}
                  disabled={!canViewInvoices}
                />
                <NavItem
                  to="/dashboard/invoices"
                  label="Hóa đơn"
                  icon={FileText}
                  disabled={!canViewInvoices}
                />
                <NavItem
                  to="/dashboard/cashflow"
                  label="Thu chi"
                  icon={Wallet}
                  disabled={!canViewInvoices}
                />
              </SidebarGroup>
            </div>

            <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
              <SidebarSectionLabel
                label="Báo cáo"
                icon={BarChart3}
                compact={isSidebarCompact}
              />
              <SidebarGroup
                label="Báo cáo căn hộ"
                icon={Building2}
                defaultOpen={canViewReports}
                compact={isSidebarCompact}
              >
                <NavItem
                  to="/dashboard/reports/apartments/vacant"
                  label="Căn hộ trống"
                  icon={Home}
                  disabled={!canViewReports}
                />
                <NavItem
                  to="/dashboard/reports/apartments/upcoming-vacant"
                  label="Căn hộ sắp trống"
                  icon={Home}
                  disabled={!canViewReports}
                />
                <NavItem
                  to="/dashboard/reports/apartments/occupancy-rate"
                  label="Tỷ lệ lấp đầy"
                  icon={BarChart3}
                  disabled={!canViewReports}
                />
              </SidebarGroup>
              <SidebarGroup
                label="Báo cáo tài chính"
                icon={Wallet}
                defaultOpen={canViewReports}
                compact={isSidebarCompact}
              >
                <NavItem
                  to="/dashboard/reports/finance/debtors"
                  label="Khách nợ tiền"
                  icon={Handshake}
                  disabled={!canViewReports}
                />
                <NavItem
                  to="/dashboard/reports/finance/payment-schedule"
                  label="Lịch thanh toán"
                  icon={FileText}
                  disabled={!canViewReports}
                />
                <NavItem
                  to="/dashboard/reports/finance/deposit-list"
                  label="Danh sách tiền cọc"
                  icon={Wallet}
                  disabled={!canViewReports}
                />
                <NavItem
                  to="/dashboard/reports/finance/cashflow"
                  label="Dòng tiền"
                  icon={BarChart3}
                  disabled={!canViewReports}
                />
              </SidebarGroup>
            </div>
            {canUseBusinessWorkspaceFeatures ? (
              <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
                <SidebarSectionLabel
                  label="Business"
                  icon={Bot}
                  compact={isSidebarCompact}
                />
                <NavItem
                  to="/dashboard/notifications"
                  label="Thông báo"
                  icon={Bell}
                  compact={isSidebarCompact}
                  disabled={!canViewBusinessNotifications}
                />
                <NavItem
                  to="/dashboard/team-chat"
                  label="Chat Team"
                  icon={MessageCircle}
                  compact={isSidebarCompact}
                  disabled={!canViewBusinessChat}
                />
                <NavItem
                  to="/dashboard/ai-assistant"
                  label="AI Công việc"
                  icon={Bot}
                  compact={isSidebarCompact}
                  disabled={!canViewBusinessAi}
                />
              </div>
            ) : null}

            <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
              <SidebarSectionLabel
                label="Cài đặt"
                icon={Settings}
                compact={isSidebarCompact}
              />
              <NavItem
                to="/dashboard/settings/forms"
                label="Biểu mẫu"
                icon={FileText}
                compact={isSidebarCompact}
                disabled={!canViewForms}
              />
              {canUseBusinessWorkspaceFeatures ? (
                <SidebarGroup
                  label="Nhân viên"
                  icon={UserCog}
                  defaultOpen={canViewUsers || canManageUserPermissions}
                  compact={isSidebarCompact}
                >
                  <NavItem
                    to="/dashboard/users"
                    label="Nhân viên"
                    icon={UserCog}
                    disabled={!canViewUsers}
                  />
                  <NavItem
                    to="/dashboard/permision"
                    label="Quản lý quyền"
                    icon={KeyRound}
                    disabled={!canManageUserPermissions}
                  />
                </SidebarGroup>
              ) : null}
            </div>
          </nav>

          <Separator />

          <div className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={`h-auto w-full items-center px-2 py-2 ${
                    isSidebarCompact ? "justify-center" : "justify-between"
                  }`}
                >
                  {!isSidebarCompact ? (
                    <div className="flex items-center gap-3 text-left">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-sm font-semibold text-foreground">
                        {user?.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={accountName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span>{accountInitial}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-none">
                          {accountName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {accountEmail}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-xs font-semibold">
                      {user?.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={accountName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{accountInitial}</span>
                      )}
                    </div>
                  )}
                  {!isSidebarCompact ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem
                  onSelect={() => {
                    setIsInfoOpen(true);
                  }}
                >
                  <BadgeInfo className="mr-2 h-4 w-4" />
                  Thông tin
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setIsSettingsOpen(true);
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Cài đặt
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive"
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
            <Button
              variant="outline"
              size="icon"
              aria-label="Thu gọn menu trái"
              onClick={() => {
                const next = !isSidebarCollapsed;
                setIsSidebarCollapsed(next);
                if (!next) setIsSidebarHovered(false);
              }}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
            <div ref={globalSearchRef} className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Tìm chức năng: hóa đơn, phòng, nhân viên, chat..."
                value={globalSearchQuery}
                onFocus={() => setIsGlobalSearchOpen(true)}
                onChange={(event) => {
                  setGlobalSearchQuery(event.target.value);
                  setIsGlobalSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setIsGlobalSearchOpen(false);
                  }
                  if (event.key !== "Enter") return;
                  const firstEnabled = globalSearchResults.find(
                    (item) => item.isEnabled,
                  );
                  if (!firstEnabled) return;
                  event.preventDefault();
                  handleOpenGlobalSearchItem(firstEnabled);
                }}
              />
              {isGlobalSearchOpen ? (
                <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-md border bg-popover p-1 shadow-lg">
                  {globalSearchResults.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-muted-foreground">
                      Không tìm thấy chức năng phù hợp.
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      {globalSearchResults.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleOpenGlobalSearchItem(item)}
                          className={`flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-muted ${
                            !item.isEnabled ? "opacity-70" : ""
                          }`}
                        >
                          <Search className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">
                                {item.label}
                              </p>
                              {!item.isEnabled ? (
                                <Lock className="h-3.5 w-3.5 text-amber-600" />
                              ) : null}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.path}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {canUseBusinessWorkspaceFeatures ? (
              <>
                <DropdownMenu
                  open={isNotificationsMenuOpen}
                  onOpenChange={setIsNotificationsMenuOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Thông báo"
                      disabled={!canViewBusinessNotifications}
                      className="relative"
                    >
                      <Bell className="h-4 w-4" />
                      {unreadNotificationCount > 0 ? (
                        <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                          {Math.min(unreadNotificationCount, 99)}
                        </span>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="bottom"
                    sideOffset={8}
                    className="w-80"
                  >
                    <DropdownMenuLabel>Thông báo mới</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {!canViewBusinessNotifications ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Bạn chưa có quyền xem thông báo.
                      </div>
                    ) : isNotificationsLoading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Đang tải thông báo...
                      </div>
                    ) : headerNotifications.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Chưa có thông báo nào trong workspace hiện tại.
                      </div>
                    ) : (
                      <div className="max-h-72 space-y-2 overflow-y-auto px-2 py-1">
                        {headerNotifications.map((item) => (
                          <div
                            key={item.id}
                            className={`rounded-md border p-2 text-xs ${
                              item.is_read
                                ? "border-border/60 bg-muted/30 text-muted-foreground"
                                : "border-primary/40 bg-primary/5 text-foreground"
                            }`}
                          >
                            <p className="font-semibold">{item.title}</p>
                            <p className="mt-1 line-clamp-2">{item.body}</p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="text-[11px] text-muted-foreground">
                                {formatDateTimeDisplay(item.published_at)}
                              </span>
                              {!item.is_read ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[11px]"
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void handleMarkNotificationRead(item.id);
                                  }}
                                >
                                  Đánh dấu đọc
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <DropdownMenuSeparator />
                    {canViewBusinessNotifications ? (
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard/notifications">
                          Mở trung tâm thông báo
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem disabled>
                        Mở trung tâm thông báo
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu
                  open={isChatMenuOpen}
                  onOpenChange={setIsChatMenuOpen}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Chat team"
                      disabled={!canViewBusinessChat}
                      className="relative"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {unreadChatCount > 0 ? (
                        <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
                          {Math.min(unreadChatCount, 99)}
                        </span>
                      ) : null}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    side="bottom"
                    sideOffset={8}
                    className="w-80"
                  >
                    <DropdownMenuLabel>Chat Team</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {!canViewBusinessChat ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Bạn chưa có quyền xem chat nội bộ.
                      </div>
                    ) : isChatPreviewLoading ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Đang tải kênh chat...
                      </div>
                    ) : headerChatPreview.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Chưa có hội thoại nào trong workspace hiện tại.
                      </div>
                    ) : (
                      <div className="max-h-72 space-y-2 overflow-y-auto px-2 py-1">
                        {headerChatPreview.map((item) => (
                          <Link
                            key={item.channel.id}
                            to={`/dashboard/team-chat?channel=${item.channel.id}`}
                            className={`block rounded-md border p-2 text-xs ${
                              item.channel.unread_count > 0
                                ? "border-primary/40 bg-primary/5"
                                : "border-border/60 bg-muted/30"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-semibold">
                                {item.channel.name}
                              </p>
                              {item.channel.unread_count > 0 ? (
                                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                  {item.channel.unread_count}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 line-clamp-2 text-muted-foreground">
                              {item.channel.last_message_content?.trim()
                                ? item.channel.last_message_content
                                : "Chưa có tin nhắn"}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {formatDateTimeDisplay(
                                item.channel.last_message_at,
                              )}
                            </p>
                          </Link>
                        ))}
                      </div>
                    )}
                    <DropdownMenuSeparator />
                    {canViewBusinessChat ? (
                      <DropdownMenuItem asChild>
                        <Link
                          to={
                            headerChatPreview[0]
                              ? `/dashboard/team-chat?channel=${headerChatPreview[0].channel.id}`
                              : "/dashboard/team-chat"
                          }
                        >
                          Mở chat trong team
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem disabled>
                        Mở chat trong team
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Sheet open={isAiSheetOpen} onOpenChange={setIsAiSheetOpen}>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="AI trợ lý"
                      disabled={!canViewBusinessAi}
                    >
                      <Bot className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-xl">
                    <SheetHeader>
                      <SheetTitle>AI xử lý công việc</SheetTitle>
                      <SheetDescription>
                        Trợ lý AI dành cho gói Business theo workspace đang
                        chọn.
                      </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6 space-y-4">
                      <div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground">
                        Gợi ý: "Hãy tóm tắt các việc cần ưu tiên hôm nay cho
                        team đang chọn."
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ai-workspace-input">Yêu cầu AI</Label>
                        <Input
                          id="ai-workspace-input"
                          value={aiQuickPrompt}
                          onChange={(event) =>
                            setAiQuickPrompt(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              openAiAssistantWithPrompt();
                            }
                          }}
                          placeholder="Nhập yêu cầu xử lý công việc..."
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Button variant="outline" asChild>
                          <Link to="/dashboard/ai-assistant">
                            Mở trang AI đầy đủ
                          </Link>
                        </Button>
                        <Button onClick={() => openAiAssistantWithPrompt()}>
                          Gửi cho AI
                        </Button>
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            ) : null}
          </div>
        </div>
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </section>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Cài đặt giao diện
            </DialogTitle>
            <DialogDescription>
              Chọn theme cho dashboard. Theme nâng cao mở theo gói đang dùng.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {themeOptions.map((item) => {
              const isActive = mode === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  disabled={!item.isEnabled}
                  onClick={() => handleThemeSelect(item.value)}
                  className={`rounded-lg border p-4 text-left transition ${
                    isActive
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  } ${!item.isEnabled ? "cursor-not-allowed opacity-60" : ""}`}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <SunMoon className="h-4 w-4" />
                    <p className="text-sm font-semibold">{item.label}</p>
                    {!item.isEnabled ? (
                      <Lock className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.description}
                  </p>
                  {isActive ? (
                    <p className="mt-2 text-xs font-medium text-primary">
                      Đang sử dụng
                    </p>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
            Gói hiện tại:{" "}
            <span className="font-semibold text-foreground">
              {subscription?.packageName || "Gói Free"}
            </span>{" "}
            ({subscription?.packageCode || "FREE"})
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isInfoOpen} onOpenChange={setIsInfoOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeInfo className="h-5 w-5 text-primary" />
              Thông tin hệ thống
            </DialogTitle>
            <DialogDescription>
              Thông tin tài khoản hiện tại, gói sử dụng và phiên bản ứng dụng.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Người dùng
              </p>
              <p className="text-sm font-semibold">{accountName}</p>
              <p className="text-sm text-muted-foreground">{accountEmail}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Provider: {user?.authProvider || "password"}
              </p>
              <p className="text-xs text-muted-foreground">
                Tenant ID: {user?.tenantId ?? "-"}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Gói dịch vụ
              </p>
              <p className="text-sm font-semibold">
                {subscription?.packageName || "Gói Free"}
              </p>
              <p className="text-sm text-muted-foreground">
                Code: {subscription?.packageCode || "FREE"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Nguồn gói: {subscription?.packageSource || "personal"}
              </p>
              <p className="text-xs text-muted-foreground">
                Team: {subscription?.teamId ?? "-"}
              </p>
              <p className="text-xs text-muted-foreground">
                Workspace: {activeWorkspaceLabel}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Quyền truy cập
              </p>
              <p className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {user?.roles.length || 0} vai trò
              </p>
              <p className="text-sm text-muted-foreground">
                {permissions.length} permission
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                Phiên bản
              </p>
              <p className="text-sm font-semibold">QuanLyPhongTro</p>
              <p className="text-sm text-muted-foreground">v{appVersion}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateWorkspaceOpen}
        onOpenChange={setIsCreateWorkspaceOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tạo workspace team</DialogTitle>
            <DialogDescription>
              Workspace mới sẽ xuất hiện trong danh sách Teams để bạn và thành
              viên làm việc chung.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="newWorkspaceName">Tên workspace team</Label>
              <Input
                id="newWorkspaceName"
                value={newWorkspaceName}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
                placeholder="Ví dụ: Team Vận hành"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newWorkspaceDescription">
                Mô tả (không bắt buộc)
              </Label>
              <Input
                id="newWorkspaceDescription"
                value={newWorkspaceDescription}
                onChange={(event) =>
                  setNewWorkspaceDescription(event.target.value)
                }
                placeholder="Mô tả ngắn cho workspace"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateWorkspaceOpen(false)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateWorkspaceTeam()}
              disabled={creatingWorkspace}
            >
              Tạo workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDeleteWorkspaceOpen}
        onOpenChange={setIsDeleteWorkspaceOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa workspace team</DialogTitle>
            <DialogDescription>
              Workspace sẽ bị xóa và thành viên đang chọn workspace này sẽ được
              chuyển về Personal.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground">
            Workspace:{" "}
            <span className="font-semibold">
              {workspaceToDelete?.name || "-"}
            </span>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsDeleteWorkspaceOpen(false);
                setWorkspaceToDelete(null);
              }}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingWorkspace}
              onClick={() => void handleDeleteWorkspaceTeam()}
            >
              Xóa workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
