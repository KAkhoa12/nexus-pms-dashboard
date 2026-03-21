import {
  type ClipboardEvent,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Send,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
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
import { teamsApi } from "@/features/teams";
import type { Team } from "@/features/teams";
import {
  type ChatAttachment,
  type ChatChannel,
  type ChatMessage,
  type ChatTypingState,
  teamChatApi,
} from "@/features/dashboard/api/team-chat.api";
import { connectCollaborationRealtimeSocket } from "@/features/dashboard/api/collaboration-realtime.api";
import { getAccessToken } from "@/services/auth/token";
import { storage } from "@/services/storage";
import { useAuthStore } from "@/store/auth.store";

const WORKSPACE_KEY = "active_workspace_key";
const MESSAGE_POLLING_MS = 3000;
const TYPING_POLLING_MS = 6000;
const PRESENCE_POLLING_MS = 15000;
const PRESENCE_HEARTBEAT_MS = 20000;
const TYPING_IDLE_MS = 1500;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveAttachmentUrl(fileUrl: string): string {
  const accessToken = getAccessToken();
  const workspaceKey = storage.get(WORKSPACE_KEY) || "personal";
  const withToken = (url: string): string => {
    const parsed = new URL(url, window.location.origin);
    if (!parsed.searchParams.has("workspace_key")) {
      parsed.searchParams.set("workspace_key", workspaceKey);
    }
    if (!accessToken) return parsed.toString();
    if (!parsed.searchParams.has("token")) {
      parsed.searchParams.set("token", accessToken);
    }
    return parsed.toString();
  };

  if (/^https?:\/\//i.test(fileUrl)) return withToken(fileUrl);
  let origin = window.location.origin;
  try {
    origin = new URL(import.meta.env.VITE_API_BASE_URL || origin).origin;
  } catch {
    origin = window.location.origin;
  }
  if (fileUrl.startsWith("/")) return withToken(`${origin}${fileUrl}`);
  if (fileUrl.startsWith("app/"))
    return withToken(`${origin}/${fileUrl.replace(/^app\//, "")}`);
  return withToken(`${origin}/${fileUrl}`);
}

function getUserInitial(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "U";
  return trimmed.charAt(0).toUpperCase();
}

export function TeamChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const preferences = useAuthStore((state) => state.preferences);

  const [teams, setTeams] = useState<Team[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<ChatTypingState[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [draftMessage, setDraftMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isMembersCollapsed, setIsMembersCollapsed] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isComposerDragActive, setIsComposerDragActive] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<number[]>([]);
  const [pendingPreviewUrls, setPendingPreviewUrls] = useState<string[]>([]);

  const typingStopTimerRef = useRef<number | null>(null);
  const typingActiveRef = useRef<boolean>(false);
  const dragDepthRef = useRef<number>(0);
  const activeChannelIdRef = useRef<number | null>(null);
  const requestedChannelIdRef = useRef<number | null>(null);
  const channelsRef = useRef<ChatChannel[]>([]);
  const currentTeamRef = useRef<Team | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const forceScrollToBottomRef = useRef<boolean>(false);
  const pendingInputRefocusRef = useRef<boolean>(false);
  const previousScrolledChannelIdRef = useRef<number | null>(null);
  const scrollSyncTimeoutIdsRef = useRef<number[]>([]);

  const workspaceKey =
    preferences?.workspaceKey || storage.get(WORKSPACE_KEY) || "personal";
  const teamId = useMemo(() => {
    if (!workspaceKey.startsWith("team:")) return null;
    const idRaw = workspaceKey.split(":", 2)[1];
    const parsed = Number(idRaw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [workspaceKey]);
  const requestedChannelId = useMemo(() => {
    const raw = searchParams.get("channel");
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [searchParams]);

  const currentTeam = useMemo(() => {
    if (!teamId) return null;
    return teams.find((item) => item.id === teamId) || null;
  }, [teamId, teams]);

  const activeChannel = useMemo(
    () => channels.find((item) => item.id === activeChannelId) || null,
    [activeChannelId, channels],
  );

  useEffect(() => {
    activeChannelIdRef.current = activeChannelId;
  }, [activeChannelId]);

  useEffect(() => {
    requestedChannelIdRef.current = requestedChannelId;
  }, [requestedChannelId]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    currentTeamRef.current = currentTeam;
  }, [currentTeam]);

  const groupChannels = useMemo(
    () => channels.filter((channel) => channel.is_group),
    [channels],
  );
  const directChannels = useMemo(
    () => channels.filter((channel) => !channel.is_group),
    [channels],
  );

  const membersById = useMemo(() => {
    const map = new Map<number, Team["members"][number]>();
    if (!currentTeam) return map;
    currentTeam.members.forEach((member) => {
      map.set(member.user_id, member);
    });
    return map;
  }, [currentTeam]);

  function getChannelDisplayName(channel: ChatChannel): string {
    if (channel.is_group) return channel.name;
    const partnerId = channel.member_user_ids.find(
      (memberId) => memberId !== user?.id,
    );
    if (!partnerId) return channel.name;
    return membersById.get(partnerId)?.full_name || channel.name;
  }

  function getDirectChannelForUser(memberUserId: number): ChatChannel | null {
    if (!user?.id) return null;
    return (
      directChannels.find(
        (channel) =>
          channel.member_user_ids.length === 2 &&
          channel.member_user_ids.includes(user.id) &&
          channel.member_user_ids.includes(memberUserId),
      ) || null
    );
  }

  function syncChannelQuery(channelId: number | null): void {
    const next = new URLSearchParams(window.location.search);
    const nextValue = channelId && channelId > 0 ? String(channelId) : null;
    const currentValue = next.get("channel");
    if ((nextValue ?? null) === (currentValue ?? null)) {
      return;
    }
    if (nextValue) {
      next.set("channel", nextValue);
    } else {
      next.delete("channel");
    }
    setSearchParams(next, { replace: true });
  }

  function selectChannel(channelId: number): void {
    if (channelId === activeChannelIdRef.current) {
      requestedChannelIdRef.current = channelId;
      syncChannelQuery(channelId);
      return;
    }
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (typingActiveRef.current && activeChannelIdRef.current) {
      void teamChatApi
        .updateTyping(activeChannelIdRef.current, false)
        .catch(() => undefined);
      typingActiveRef.current = false;
    }
    setTypingUsers([]);
    forceScrollToBottomRef.current = true;
    requestedChannelIdRef.current = channelId;
    setActiveChannelId(channelId);
    syncChannelQuery(channelId);
  }

  function scrollMessagesToBottom(behavior: ScrollBehavior = "auto") {
    const performScroll = () => {
      const viewport = messageScrollRef.current;
      if (viewport) {
        if (behavior === "auto") {
          viewport.scrollTop = viewport.scrollHeight;
        } else {
          viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior,
          });
        }
      }
      messageEndRef.current?.scrollIntoView({
        block: "end",
        behavior,
      });
    };
    window.requestAnimationFrame(() => {
      performScroll();
      window.requestAnimationFrame(performScroll);
    });
  }

  function clearScheduledBottomScrolls() {
    scrollSyncTimeoutIdsRef.current.forEach((timerId) =>
      window.clearTimeout(timerId),
    );
    scrollSyncTimeoutIdsRef.current = [];
  }

  function scheduleBottomScrollSync(behavior: ScrollBehavior = "auto") {
    clearScheduledBottomScrolls();
    const delays = [0, 90, 220, 380];
    delays.forEach((delay) => {
      const timerId = window.setTimeout(() => {
        scrollMessagesToBottom(behavior);
      }, delay);
      scrollSyncTimeoutIdsRef.current.push(timerId);
    });
  }

  function isNearBottom(offset = 160): boolean {
    const viewport = messageScrollRef.current;
    if (!viewport) return true;
    const distanceToBottom =
      viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
    return distanceToBottom <= offset;
  }

  async function fetchTeams() {
    setLoadingTeams(true);
    try {
      const items = await teamsApi.getMyTeams();
      setTeams(items);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tải danh sách team."));
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  }

  async function fetchChannels(currentTeamId: number, memberUserIds: number[]) {
    setLoadingChannels(true);
    try {
      const allChannels = await teamChatApi.listChannels();
      let teamChannels = allChannels.filter(
        (channel) => channel.team_id === currentTeamId && channel.is_active,
      );

      if (teamChannels.length === 0) {
        const created = await teamChatApi.createChannel({
          name: "General",
          team_id: currentTeamId,
          is_group: true,
          member_user_ids: memberUserIds,
        });
        teamChannels = [created];
      }

      setChannels(teamChannels);
      const previous = activeChannelIdRef.current;
      const requested = requestedChannelIdRef.current;
      let nextChannelId: number | null = null;
      if (previous && teamChannels.some((item) => item.id === previous)) {
        nextChannelId = previous;
      } else if (
        requested &&
        teamChannels.some((item) => item.id === requested)
      ) {
        nextChannelId = requested;
      } else {
        nextChannelId = teamChannels[0]?.id || null;
      }
      if (nextChannelId !== previous) {
        forceScrollToBottomRef.current = true;
        previousScrolledChannelIdRef.current = null;
        setTypingUsers([]);
        setActiveChannelId(nextChannelId);
      }
      const queryRaw = new URLSearchParams(window.location.search).get(
        "channel",
      );
      const queryParsed = queryRaw ? Number(queryRaw) : null;
      const queryChannelId =
        queryParsed && Number.isFinite(queryParsed) && queryParsed > 0
          ? queryParsed
          : null;
      if (queryChannelId !== nextChannelId) {
        requestedChannelIdRef.current = nextChannelId;
        syncChannelQuery(nextChannelId);
      }
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Không thể tải kênh chat trong team."),
      );
      setChannels([]);
      setActiveChannelId(null);
    } finally {
      setLoadingChannels(false);
    }
  }

  async function fetchMessages(channelId: number, forceScroll = false) {
    if (!accessToken) {
      setMessages([]);
      return;
    }
    if (channelId === activeChannelIdRef.current) {
      setLoadingMessages(true);
    }
    try {
      const items = await teamChatApi.listMessages(channelId);
      if (channelId !== activeChannelIdRef.current) {
        return;
      }
      if (forceScroll) {
        forceScrollToBottomRef.current = true;
      }
      setMessages(items);
      if (forceScroll) {
        scheduleBottomScrollSync("auto");
      }
    } catch (error) {
      if (channelId !== activeChannelIdRef.current) {
        return;
      }
      toast.error(getErrorMessage(error, "Không thể tải lịch sử chat."));
      setMessages([]);
    } finally {
      if (channelId === activeChannelIdRef.current) {
        setLoadingMessages(false);
      }
    }
  }

  async function fetchTypingStates(channelId: number) {
    if (!accessToken) {
      setTypingUsers([]);
      return;
    }
    try {
      const states = await teamChatApi.listTyping(channelId);
      if (channelId !== activeChannelIdRef.current) {
        return;
      }
      setTypingUsers(
        states.filter((item) => item.is_typing && item.user_id !== user?.id),
      );
    } catch {
      setTypingUsers([]);
    }
  }

  async function fetchPresence(teamScopeId: number) {
    if (!accessToken) {
      setOnlineUserIds(new Set());
      return;
    }
    try {
      const states = await teamChatApi.listPresence(teamScopeId);
      const online = new Set<number>();
      states.forEach((item) => {
        if (item.is_online) online.add(item.user_id);
      });
      setOnlineUserIds(online);
    } catch {
      setOnlineUserIds(new Set());
    }
  }

  useEffect(() => {
    void fetchTeams();
  }, []);

  useEffect(() => {
    if (!currentTeam) {
      setChannels([]);
      setActiveChannelId(null);
      return;
    }
    const memberUserIds = currentTeam.members.map((item) => item.user_id);
    void fetchChannels(currentTeam.id, memberUserIds);
  }, [currentTeam?.id]);

  useEffect(() => {
    if (!requestedChannelId) return;
    if (!channels.some((item) => item.id === requestedChannelId)) return;
    if (activeChannelIdRef.current === requestedChannelId) return;
    forceScrollToBottomRef.current = true;
    previousScrolledChannelIdRef.current = null;
    setTypingUsers([]);
    setActiveChannelId(requestedChannelId);
  }, [requestedChannelId, channels]);

  useEffect(() => {
    if (!accessToken || !user?.id || !workspaceKey || !currentTeam) {
      setWsConnected(false);
      return;
    }

    const socket = connectCollaborationRealtimeSocket({
      workspaceKey,
      onConnectedChange: (connected) => {
        setWsConnected(connected);
      },
      onEvent: (event) => {
        const eventType = String(event.type || "").toLowerCase();
        const payload = event.payload || {};

        if (eventType === "chat_message") {
          const roomId = Number(payload.room_id || 0);
          if (roomId <= 0) return;
          const senderUserId = Number(payload.sender_user_id || 0);

          if (roomId === activeChannelIdRef.current) {
            if (senderUserId && senderUserId === user?.id) {
              return;
            }
            void fetchMessages(roomId);
            return;
          }

          if (!channelsRef.current.some((item) => item.id === roomId)) {
            const team = currentTeamRef.current;
            if (!team) return;
            const memberUserIds = team.members.map((item) => item.user_id);
            void fetchChannels(team.id, memberUserIds);
          }
          return;
        }

        if (eventType === "typing") {
          const roomId = Number(payload.room_id || 0);
          if (roomId > 0 && roomId === activeChannelIdRef.current) {
            const typingUserId = Number(payload.user_id || 0);
            const isTyping = Boolean(payload.is_typing);
            if (!typingUserId || typingUserId === user?.id) return;
            const team = currentTeamRef.current;
            const matchedMember = team?.members.find(
              (item) => item.user_id === typingUserId,
            );
            const nowIso = new Date().toISOString();
            setTypingUsers((previous) => {
              const remaining = previous.filter(
                (item) => item.user_id !== typingUserId,
              );
              if (!isTyping) {
                return remaining;
              }
              return [
                ...remaining,
                {
                  user_id: typingUserId,
                  full_name:
                    matchedMember?.full_name || `User #${typingUserId}`,
                  avatar_url: null,
                  is_typing: true,
                  last_typed_at:
                    typeof payload.updated_at === "string"
                      ? payload.updated_at
                      : nowIso,
                  expires_at: null,
                },
              ];
            });
          }
          return;
        }

        if (eventType === "presence") {
          const presenceUserId = Number(payload.user_id || 0);
          const isOnline = Boolean(payload.is_online);
          if (!presenceUserId) return;
          setOnlineUserIds((previous) => {
            const next = new Set(previous);
            if (isOnline) {
              next.add(presenceUserId);
            } else {
              next.delete(presenceUserId);
            }
            return next;
          });
        }
      },
    });

    return () => {
      socket.close();
      setWsConnected(false);
    };
  }, [accessToken, currentTeam?.id, user?.id, workspaceKey]);

  useEffect(() => {
    if (!activeChannelId) {
      setMessages([]);
      return;
    }
    if (!accessToken) {
      setMessages([]);
      return;
    }
    forceScrollToBottomRef.current = true;
    void fetchMessages(activeChannelId, true);
    if (wsConnected) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void fetchMessages(activeChannelId);
    }, MESSAGE_POLLING_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [accessToken, activeChannelId, wsConnected]);

  useEffect(() => {
    if (!activeChannelId) return;
    forceScrollToBottomRef.current = true;
    previousScrolledChannelIdRef.current = null;
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeChannelId || loadingMessages) return;
    if (previousScrolledChannelIdRef.current === activeChannelId) return;
    previousScrolledChannelIdRef.current = activeChannelId;
    scrollMessagesToBottom("auto");
  }, [activeChannelId, loadingMessages, messages.length]);

  useEffect(() => {
    if (!messages.length) return;
    if (forceScrollToBottomRef.current) {
      forceScrollToBottomRef.current = false;
      scheduleBottomScrollSync("auto");
      return;
    }
    const viewport = messageScrollRef.current;
    if (!viewport) return;
    const distanceToBottom =
      viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight);
    const shouldAutoScroll = distanceToBottom < 120;
    if (!shouldAutoScroll) return;
    scheduleBottomScrollSync("smooth");
  }, [messages]);

  useEffect(() => {
    return () => {
      clearScheduledBottomScrolls();
    };
  }, []);

  useEffect(() => {
    if (sendingMessage) return;
    if (!pendingInputRefocusRef.current) return;
    pendingInputRefocusRef.current = false;
    window.requestAnimationFrame(() => {
      draftInputRef.current?.focus();
    });
  }, [sendingMessage, activeChannelId]);

  useEffect(() => {
    const nextUrls = pendingFiles.map((file) => URL.createObjectURL(file));
    setPendingPreviewUrls(nextUrls);
    return () => {
      nextUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [pendingFiles]);

  useEffect(() => {
    if (!activeChannelId) {
      setTypingUsers([]);
      return;
    }
    if (!accessToken) {
      setTypingUsers([]);
      return;
    }
    void fetchTypingStates(activeChannelId);
    if (wsConnected) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void fetchTypingStates(activeChannelId);
    }, TYPING_POLLING_MS);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [accessToken, activeChannelId, user?.id, wsConnected]);

  useEffect(() => {
    if (!currentTeam) {
      setOnlineUserIds(new Set());
      return;
    }
    if (!accessToken) {
      setOnlineUserIds(new Set());
      return;
    }
    void teamChatApi.heartbeatPresence(true).catch(() => undefined);
    void fetchPresence(currentTeam.id);
    const heartbeatId = window.setInterval(() => {
      void teamChatApi.heartbeatPresence(true).catch(() => undefined);
    }, PRESENCE_HEARTBEAT_MS);
    const pollId = wsConnected
      ? null
      : window.setInterval(() => {
          void fetchPresence(currentTeam.id);
        }, PRESENCE_POLLING_MS);

    return () => {
      window.clearInterval(heartbeatId);
      if (pollId !== null) {
        window.clearInterval(pollId);
      }
      void teamChatApi.heartbeatPresence(false).catch(() => undefined);
    };
  }, [accessToken, currentTeam?.id, wsConnected]);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }
      typingActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!activeChannelId) return;
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = null;
      }
      if (!typingActiveRef.current) {
        return;
      }
      typingActiveRef.current = false;
      void teamChatApi
        .updateTyping(activeChannelId, false)
        .catch(() => undefined);
    };
  }, [activeChannelId]);

  function setTypingActive() {
    if (!activeChannelId) return;
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      void teamChatApi
        .updateTyping(activeChannelId, true)
        .catch(() => undefined);
    }

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }
    typingStopTimerRef.current = window.setTimeout(() => {
      if (!activeChannelId) return;
      typingActiveRef.current = false;
      void teamChatApi
        .updateTyping(activeChannelId, false)
        .catch(() => undefined);
    }, TYPING_IDLE_MS);
  }

  async function stopTyping() {
    if (!activeChannelId) return;
    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (!typingActiveRef.current) {
      return;
    }
    typingActiveRef.current = false;
    await teamChatApi.updateTyping(activeChannelId, false);
  }

  function handleDraftChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setDraftMessage(event.target.value);
    setTypingActive();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  }

  function handleAttachmentImageLoad() {
    if (forceScrollToBottomRef.current || isNearBottom()) {
      scheduleBottomScrollSync("auto");
    }
  }

  function appendPendingFiles(files: File[]) {
    if (!files.length) return;
    setPendingFiles((previous) => {
      const next = [...previous];
      files.forEach((file) => {
        const existed = next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified,
        );
        if (!existed) {
          next.push(file);
        }
      });
      return next;
    });
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    appendPendingFiles(files);
    event.target.value = "";
  }

  function handleChatFrameDragEnter(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsComposerDragActive(true);
  }

  function handleChatFrameDragOver(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    if (!isComposerDragActive) {
      setIsComposerDragActive(true);
    }
  }

  function handleChatFrameDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsComposerDragActive(false);
    }
  }

  function handleChatFrameDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsComposerDragActive(false);
    const files = Array.from(event.dataTransfer?.files || []);
    if (!files.length) return;
    appendPendingFiles(files);
  }

  function handleDraftPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter(
        (file): file is File =>
          file !== null && (file.type || "").startsWith("image/"),
      );
    if (!imageFiles.length) return;
    event.preventDefault();
    appendPendingFiles(imageFiles);
  }

  function removePendingFile(index: number) {
    setPendingFiles((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  async function handleOpenDirectChat(memberUserId: number, fullName: string) {
    if (!currentTeam || !user?.id || creatingChannel) return;
    const existing = getDirectChannelForUser(memberUserId);
    if (existing) {
      selectChannel(existing.id);
      return;
    }
    setCreatingChannel(true);
    try {
      const created = await teamChatApi.createChannel({
        name: `DM ${fullName}`,
        team_id: currentTeam.id,
        is_group: false,
        member_user_ids: [memberUserId],
      });
      setChannels((previous) => [created, ...previous]);
      selectChannel(created.id);
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tạo chat riêng."));
    } finally {
      setCreatingChannel(false);
    }
  }

  function openCreateGroupDialog() {
    if (!currentTeam) return;
    setNewGroupName("");
    setNewGroupMemberIds(
      currentTeam.members
        .map((member) => member.user_id)
        .filter((memberUserId) => memberUserId !== user?.id),
    );
    setIsCreateGroupOpen(true);
  }

  async function handleCreateGroupFromDialog() {
    if (!currentTeam || creatingChannel) return;
    const normalizedName = newGroupName.trim();
    if (normalizedName.length < 2) {
      toast.error("Tên nhóm chat cần ít nhất 2 ký tự.");
      return;
    }
    if (newGroupMemberIds.length === 0) {
      toast.error("Hãy chọn ít nhất 1 thành viên.");
      return;
    }

    setCreatingChannel(true);
    try {
      const created = await teamChatApi.createChannel({
        name: normalizedName,
        team_id: currentTeam.id,
        is_group: true,
        member_user_ids: newGroupMemberIds,
      });
      setChannels((previous) => [created, ...previous]);
      selectChannel(created.id);
      setIsCreateGroupOpen(false);
      toast.success("Đã tạo nhóm chat mới.");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể tạo nhóm chat."));
    } finally {
      setCreatingChannel(false);
    }
  }

  async function handleSendMessage() {
    if (!accessToken || !activeChannelId || sendingMessage) return;
    const content = draftMessage.trim();
    if (!content && pendingFiles.length === 0) return;

    let sentSuccessfully = false;
    setSendingMessage(true);
    try {
      const uploaded = await Promise.all(
        pendingFiles.map((file) => teamChatApi.uploadChatFile(file)),
      );
      const attachments: ChatAttachment[] = uploaded.map((item) => ({
        file_name: item.file_name,
        file_url: item.file_url,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
      }));

      const sentMessage = await teamChatApi.sendMessage({
        channel_id: activeChannelId,
        content,
        message_type: attachments.length > 0 && !content ? "FILE" : "TEXT",
        attachments,
      });

      setMessages((previous) => {
        if (previous.some((item) => item.id === sentMessage.id)) {
          return previous;
        }
        return [...previous, sentMessage];
      });

      setDraftMessage("");
      if (draftInputRef.current) {
        draftInputRef.current.style.height = "42px";
      }
      setPendingFiles([]);
      sentSuccessfully = true;
      await stopTyping().catch(() => undefined);
      if (!wsConnected) {
        await fetchMessages(activeChannelId);
      }
      scrollMessagesToBottom("smooth");
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể gửi tin nhắn."));
    } finally {
      if (sentSuccessfully) {
        pendingInputRefocusRef.current = true;
      }
      setSendingMessage(false);
    }
  }

  if (!teamId) {
    return (
      <section className="space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Users className="h-5 w-5 text-primary" />
            Chat trong team
          </h1>
          <p className="text-sm text-muted-foreground">
            Hãy chuyển sang một workspace team để sử dụng chat nội bộ.
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Workspace hiện tại là <span className="font-medium">Personal</span>.
            Vui lòng chọn một team ở dropdown workspace trong sidebar.
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Users className="h-5 w-5 text-primary" />
          Chat trong team
        </h1>
        <p className="text-sm text-muted-foreground">
          Workspace: {currentTeam?.name || `Team #${teamId}`} - chat đơn, chat
          nhóm, gửi ảnh/file lên MinIO, và typing theo polling.
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="flex h-[72vh] min-h-0 flex-col gap-0 p-0 lg:grid lg:grid-cols-[340px_1fr]">
          <aside className="flex max-h-[45%] min-h-[220px] flex-col border-b bg-muted/20 lg:max-h-none lg:min-h-0 lg:border-b-0 lg:border-r">
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Thành viên trong team</p>
                  <p className="text-xs text-muted-foreground">
                    {loadingTeams
                      ? "Đang tải..."
                      : `${currentTeam?.members.length || 0} thành viên`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMembersCollapsed((previous) => !previous)}
                  aria-label="Thu gọn thành viên"
                >
                  {isMembersCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {!isMembersCollapsed ? (
              <div className="max-h-56 overflow-y-auto px-3 py-2 lg:max-h-[42%]">
                {(currentTeam?.members || []).map((member) => {
                  const isOnline = onlineUserIds.has(member.user_id);
                  const canOpenDirect = member.user_id !== user?.id;
                  return (
                    <div
                      key={member.user_id}
                      className="mb-2 rounded-md border border-border/60 bg-background px-2 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {getUserInitial(member.full_name)}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-background ${
                              isOnline
                                ? "bg-emerald-500"
                                : "bg-muted-foreground/50"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {member.full_name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {member.email}
                          </p>
                        </div>
                      </div>
                      {canOpenDirect ? (
                        <div className="mt-2 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() =>
                              void handleOpenDirectChat(
                                member.user_id,
                                member.full_name,
                              )
                            }
                            disabled={creatingChannel}
                          >
                            Chat riêng
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="border-b border-t px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Nhóm chat</p>
                  <p className="text-xs text-muted-foreground">
                    {loadingChannels
                      ? "Đang tải..."
                      : `${groupChannels.length} nhóm`}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={openCreateGroupDialog}
                  disabled={!currentTeam || creatingChannel}
                  title="Tạo nhóm chat"
                >
                  {creatingChannel ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
              <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Group
              </p>
              {groupChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => selectChannel(channel.id)}
                  className={`mb-2 flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left ${
                    activeChannelId === channel.id
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-background hover:bg-muted/50"
                  }`}
                >
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {channel.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {channel.member_user_ids.length} thành viên
                    </p>
                  </div>
                </button>
              ))}

              <p className="mb-2 mt-3 text-xs font-semibold uppercase text-muted-foreground">
                Chat riêng
              </p>
              {directChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => selectChannel(channel.id)}
                  className={`mb-2 flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left ${
                    activeChannelId === channel.id
                      ? "border-primary bg-primary/10"
                      : "border-border/60 bg-background hover:bg-muted/50"
                  }`}
                >
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {getChannelDisplayName(channel)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      1-1 conversation
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section
            className="relative flex min-h-0 flex-col"
            onDragEnter={handleChatFrameDragEnter}
            onDragOver={handleChatFrameDragOver}
            onDragLeave={handleChatFrameDragLeave}
            onDrop={handleChatFrameDrop}
          >
            {isComposerDragActive ? (
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-primary/5">
                <div className="rounded-lg border border-dashed border-primary/60 bg-background/90 px-4 py-2 text-sm font-medium text-primary shadow-sm">
                  Thả file/ảnh vào đây để đính kèm tin nhắn
                </div>
              </div>
            ) : null}
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4 text-primary" />
                {activeChannel
                  ? getChannelDisplayName(activeChannel)
                  : "Chọn kênh chat"}
              </CardTitle>
              {typingUsers.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {typingUsers.map((item) => item.full_name).join(", ")} đang
                  gõ...
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Kênh chat nội bộ theo workspace team.
                </p>
              )}
            </CardHeader>

            <div
              ref={messageScrollRef}
              className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
            >
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tải tin nhắn...
                </div>
              ) : null}
              {!loadingMessages && messages.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  Chưa có tin nhắn nào trong kênh này.
                </div>
              ) : null}

              <div className="space-y-3">
                {messages.map((message) => {
                  const isMine = message.sender_user_id === user?.id;
                  const sender =
                    (message.sender_user_id
                      ? membersById.get(message.sender_user_id)?.full_name
                      : null) ||
                    (isMine ? "Bạn" : `User #${message.sender_user_id || "-"}`);

                  return (
                    <div
                      key={message.id}
                      className={`w-fit max-w-[min(85%,44rem)] rounded-lg border px-3 py-2 text-sm ${
                        isMine
                          ? "ml-auto border-primary/30 bg-primary text-primary-foreground"
                          : "border-border/70 bg-background"
                      }`}
                    >
                      <p
                        className={`mb-1 text-xs ${isMine ? "opacity-80" : "text-muted-foreground"}`}
                      >
                        {sender}
                      </p>
                      {message.content ? (
                        <p className="whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                      ) : null}

                      {message.attachments.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {message.attachments.map((attachment, index) => {
                            const url = resolveAttachmentUrl(
                              attachment.file_url,
                            );
                            const isImage = (
                              attachment.mime_type || ""
                            ).startsWith("image/");
                            return (
                              <div
                                key={`${message.id}-${index}`}
                                className={`rounded-md border p-2 ${
                                  isMine
                                    ? "border-primary-foreground/20 bg-primary-foreground/10"
                                    : "border-border/70 bg-muted/30"
                                }`}
                              >
                                {isImage ? (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block"
                                  >
                                    <img
                                      src={url}
                                      alt={attachment.file_name}
                                      onLoad={handleAttachmentImageLoad}
                                      className="h-auto w-auto max-h-72 max-w-[min(70vw,30rem)] rounded-md object-contain"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`inline-flex items-center gap-2 text-xs ${
                                      isMine
                                        ? "text-primary-foreground"
                                        : "text-foreground"
                                    }`}
                                  >
                                    <Paperclip className="h-3.5 w-3.5" />
                                    {attachment.file_name}
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      <p
                        className={`mt-2 text-[11px] ${isMine ? "opacity-70" : "text-muted-foreground"}`}
                      >
                        {formatMessageTime(message.created_at)}
                      </p>
                    </div>
                  );
                })}
                <div ref={messageEndRef} />
              </div>
            </div>

            <div className="border-t px-4 py-3">
              {pendingFiles.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {pendingFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
                    >
                      {(file.type || "").startsWith("image/") &&
                      pendingPreviewUrls[index] ? (
                        <img
                          src={pendingPreviewUrls[index]}
                          alt={file.name}
                          className="h-auto w-auto max-h-12 max-w-12 rounded object-contain"
                        />
                      ) : (file.type || "").startsWith("image/") ? (
                        <ImageIcon className="h-3.5 w-3.5" />
                      ) : (
                        <Paperclip className="h-3.5 w-3.5" />
                      )}
                      <span className="max-w-44 truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(index)}
                        className="rounded-full p-0.5 hover:bg-muted"
                        aria-label="Xóa file"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex items-end gap-2">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-2 hover:bg-muted">
                  <Paperclip className="h-4 w-4" />
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileInput}
                  />
                </label>
                <textarea
                  ref={draftInputRef}
                  value={draftMessage}
                  onChange={handleDraftChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handleDraftPaste}
                  onInput={(event) => {
                    const element = event.currentTarget;
                    element.style.height = "42px";
                    const nextHeight = Math.min(element.scrollHeight, 180);
                    element.style.height = `${nextHeight}px`;
                  }}
                  onBlur={() => {
                    void stopTyping().catch(() => undefined);
                  }}
                  placeholder="Nhập tin nhắn..."
                  disabled={!activeChannelId || sendingMessage}
                  rows={1}
                  className="min-h-[42px] max-h-[180px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-5 outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Button
                  type="button"
                  onClick={() => void handleSendMessage()}
                  disabled={!activeChannelId || sendingMessage}
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      <Dialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tạo nhóm chat trong team</DialogTitle>
            <DialogDescription>
              Chọn tên nhóm và thành viên sẽ tham gia vào nhóm chat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Tên nhóm</label>
              <Input
                value={newGroupName}
                onChange={(event) => setNewGroupName(event.target.value)}
                placeholder="Ví dụ: Team Kinh Doanh"
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Thành viên</p>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border/60 p-3">
                {(currentTeam?.members || [])
                  .filter((member) => member.user_id !== user?.id)
                  .map((member) => {
                    const checked = newGroupMemberIds.includes(member.user_id);
                    return (
                      <label
                        key={member.user_id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            const nextChecked = event.target.checked;
                            setNewGroupMemberIds((previous) => {
                              if (nextChecked) {
                                return Array.from(
                                  new Set([...previous, member.user_id]),
                                );
                              }
                              return previous.filter(
                                (id) => id !== member.user_id,
                              );
                            });
                          }}
                        />
                        <span>{member.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {member.email}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateGroupOpen(false)}
            >
              Hủy
            </Button>
            <Button
              onClick={() => void handleCreateGroupFromDialog()}
              disabled={creatingChannel}
            >
              {creatingChannel ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Tạo nhóm"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
