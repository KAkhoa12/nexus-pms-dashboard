import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  Bot,
  Loader2,
  Menu,
  PauseCircle,
  PlayCircle,
  RotateCcw,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type AgentExecutionMode,
  type AgentModelTier,
  type AgentQueryResult,
  type AgentRunStatusResult,
  type AgentRunStatus,
  agentsApi,
} from "@/features/dashboard/api/agents.api";
import { hasAnyPermission } from "@/services/auth/permissions";
import { storage } from "@/services/storage";
import { useAuthStore } from "@/store/auth.store";

const WORKSPACE_KEY = "active_workspace_key";
const LONG_THREAD_MESSAGE_LIMIT = 36;
const MAX_ARCHIVE_SESSIONS = 20;

type ConversationItem = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  result?: AgentQueryResult;
  isError?: boolean;
  runId?: string;
};

type ArchivedSessionItem = {
  sessionId: string;
  threadId: string | null;
  title: string;
  updatedAt: string;
  messageCount: number;
  messages: ConversationItem[];
};

const EXECUTION_MODE_OPTIONS: Array<{
  value: AgentExecutionMode;
  label: string;
  description: string;
}> = [
  {
    value: "read_only",
    label: "Chỉ đọc",
    description: "An toàn, chỉ phân tích dữ liệu.",
  },
  {
    value: "propose_write",
    label: "Đề xuất ghi",
    description: "Tạo đề xuất, chưa thực thi.",
  },
  {
    value: "approved_write",
    label: "Đã duyệt ghi",
    description: "Chỉ dùng khi có cơ chế phê duyệt hợp lệ.",
  },
];

const MODEL_TIER_OPTIONS: Array<{
  value: AgentModelTier;
  label: string;
}> = [
  { value: "standard", label: "Chuẩn" },
  { value: "cheap", label: "Tiết kiệm" },
];

const QUICK_PROMPTS: Array<{ label: string; prompt: string }> = [
  {
    label: "KPI vận hành",
    prompt: "Cho tôi KPI vận hành hiện tại trong workspace đang chọn.",
  },
  {
    label: "Thành viên team",
    prompt: "Trong team tôi bao gồm ai?",
  },
  {
    label: "Trạng thái phòng",
    prompt:
      "Cho tôi trạng thái phòng hiện tại và liệt kê chi nhánh, khu vực, tòa nhà liên quan.",
  },
  {
    label: "Kỳ hạn hóa đơn",
    prompt:
      "Tra cứu kỳ hạn hóa đơn theo mã hợp đồng hoặc khách hàng và tóm tắt các khoản cần đóng.",
  },
  {
    label: "Gợi ý thông báo",
    prompt:
      "Soạn nháp thông báo cho thành viên team về các khoản cần xử lý trong tuần này.",
  },
];

function toClientId(prefix: string): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `${prefix}_${window.crypto.randomUUID().replaceAll("-", "")}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { message?: string; detail?: unknown }
      | undefined;
    if (typeof data?.message === "string" && data.message.trim().length > 0) {
      return data.message;
    }
    if (typeof data?.detail === "string" && data.detail.trim().length > 0) {
      return data.detail;
    }
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function formatDateTime(value: string): string {
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

function isTerminalStatus(status: AgentRunStatus | null): boolean {
  return (
    status === "completed" || status === "failed" || status === "cancelled"
  );
}

function parseEventData(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function normalizeQueryResult(value: unknown): AgentQueryResult | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AgentQueryResult> &
    Record<string, unknown>;
  if (!Array.isArray(candidate.tool_results)) return null;
  if (
    !candidate.runtime_context ||
    typeof candidate.runtime_context !== "object"
  ) {
    return null;
  }
  return candidate as AgentQueryResult;
}

function getToolCallCount(result: AgentQueryResult | undefined): number {
  const toolResults = (result as unknown as { tool_results?: unknown })
    ?.tool_results;
  return Array.isArray(toolResults) ? toolResults.length : 0;
}

function getAllowedToolsCount(result: AgentQueryResult | undefined): number {
  const allowedTools = (
    result as unknown as {
      runtime_context?: { allowed_tools?: unknown };
    }
  )?.runtime_context?.allowed_tools;
  return Array.isArray(allowedTools) ? allowedTools.length : 0;
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:border [&_pre]:bg-muted [&_pre]:p-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            />
          ),
        }}
      >
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}

function buildSessionTitle(messages: ConversationItem[]): string {
  const firstUser = messages.find((item) => item.role === "user");
  const raw = (firstUser?.content || "").trim();
  if (!raw) return "Phiên hội thoại";
  if (raw.length <= 56) return raw;
  return `${raw.slice(0, 56)}...`;
}

function toEpoch(value: string | null | undefined): number {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : 0;
}

function sortRunsByCreated(
  rows: AgentRunStatusResult[],
  direction: "asc" | "desc" = "asc",
): AgentRunStatusResult[] {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    const leftTs = toEpoch(left.created_at);
    const rightTs = toEpoch(right.created_at);
    const diff = leftTs - rightTs;
    if (diff !== 0) {
      return direction === "asc" ? diff : -diff;
    }
    const byRunId = left.run_id.localeCompare(right.run_id);
    return direction === "asc" ? byRunId : -byRunId;
  });
  return sorted;
}

function buildMessagesFromRuns(
  rows: AgentRunStatusResult[],
): ConversationItem[] {
  const ordered = sortRunsByCreated(rows, "asc");
  const next: ConversationItem[] = [];

  for (const run of ordered) {
    const createdAt = run.created_at || new Date().toISOString();
    next.push({
      id: `u_${run.run_id}`,
      role: "user",
      content: String(run.message || ""),
      createdAt,
      runId: run.run_id,
    });

    let assistantText = String(
      run.final_answer || run.partial_answer || run.error_message || "",
    ).trim();
    if (!assistantText) {
      if (run.status === "running" || run.status === "queued") {
        assistantText = "AI đang xử lý...";
      } else if (run.status === "cancelled") {
        assistantText = "Đã dừng phiên AI theo yêu cầu.";
      } else if (run.status === "failed") {
        assistantText = "AI gặp lỗi trong quá trình xử lý.";
      }
    }

    next.push({
      id: `a_${run.run_id}`,
      role: "assistant",
      content: assistantText,
      createdAt,
      runId: run.run_id,
      isError: run.status === "failed",
      result: normalizeQueryResult(run.result) || undefined,
    });
  }

  return next;
}

function buildSessionArchivesFromRuns(
  rows: AgentRunStatusResult[],
): ArchivedSessionItem[] {
  const grouped = new Map<string, AgentRunStatusResult[]>();
  for (const row of rows) {
    const key = (row.session_id || "").trim();
    if (!key) continue;
    const bucket = grouped.get(key) || [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  const archives: ArchivedSessionItem[] = [];
  grouped.forEach((sessionRuns, sessionKey) => {
    const ordered = sortRunsByCreated(sessionRuns, "asc");
    const last = ordered[ordered.length - 1];
    const messages = buildMessagesFromRuns(ordered);
    archives.push({
      sessionId: sessionKey,
      threadId: last?.thread_id || null,
      title: buildSessionTitle(messages),
      updatedAt: last?.created_at || new Date().toISOString(),
      messageCount: messages.length,
      messages,
    });
  });

  return archives.sort((left, right) => {
    return toEpoch(right.updatedAt) - toEpoch(left.updatedAt);
  });
}

function getLatestActiveRun(
  rows: AgentRunStatusResult[],
): AgentRunStatusResult | null {
  const active = rows.filter(
    (row) => row.status === "queued" || row.status === "running",
  );
  if (active.length === 0) return null;
  return sortRunsByCreated(active, "desc")[0] || null;
}

export function AiWorkAssistantPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const permissions = useAuthStore((state) => state.permissions);
  const subscription = useAuthStore((state) => state.subscription);
  const preferences = useAuthStore((state) => state.preferences);

  const workspaceKey =
    preferences?.workspaceKey || storage.get(WORKSPACE_KEY) || "personal";
  const workspaceLabel = workspaceKey.startsWith("team:")
    ? `Team ${workspaceKey.split(":", 2)[1]}`
    : "Personal";

  const isBusinessPackage = subscription?.packageCode === "BUSINESS";
  const isPersonalWorkspace = workspaceKey === "personal";
  const canUseBusinessWorkspaceFeatures =
    isBusinessPackage && !isPersonalWorkspace;
  const canUseAgentPermission = hasAnyPermission(permissions, [
    "agents:query",
    "collaboration:ai:sessions:view",
    "collaboration:ai:messages:create",
    "user:mangage",
  ]);
  const canUseAgent = canUseBusinessWorkspaceFeatures && canUseAgentPermission;

  const [executionMode, setExecutionMode] =
    useState<AgentExecutionMode>("read_only");
  const [modelTier, setModelTier] = useState<AgentModelTier>("standard");
  const [draft, setDraft] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() =>
    toClientId("session"),
  );
  const [messages, setMessages] = useState<ConversationItem[]>([]);
  const [sessionArchives, setSessionArchives] = useState<ArchivedSessionItem[]>(
    [],
  );
  const [isSessionPanelOpen, setIsSessionPanelOpen] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunStatus, setActiveRunStatus] = useState<AgentRunStatus | null>(
    null,
  );
  const [startingRun, setStartingRun] = useState(false);
  const [cancellingRun, setCancellingRun] = useState(false);

  const autoSentTokenRef = useRef<string>("");
  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const lastEventIdRef = useRef<number>(0);
  const activeRunStatusRef = useRef<AgentRunStatus | null>(null);
  const longThreadWarnedRef = useRef<string>("");

  const isRunExecuting =
    activeRunStatus === "queued" || activeRunStatus === "running";
  const shouldRecommendNewThread = messages.length >= LONG_THREAD_MESSAGE_LIMIT;
  const requestedSessionId = (searchParams.get("session") || "").trim();
  const visibleArchives = [...sessionArchives].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );

  useEffect(() => {
    activeRunStatusRef.current = activeRunStatus;
  }, [activeRunStatus]);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const persistActiveRun = useCallback((runId: string | null) => {
    void runId;
  }, []);

  const focusDraftInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      draftInputRef.current?.focus();
    });
  }, []);

  const syncSessionQuery = useCallback(
    (nextSessionId: string | null, replace = true) => {
      const current = (searchParams.get("session") || "").trim();
      const normalizedNext = (nextSessionId || "").trim();
      if (current === normalizedNext) {
        return;
      }
      const next = new URLSearchParams(searchParams);
      if (normalizedNext.length > 0) {
        next.set("session", normalizedNext);
      } else {
        next.delete("session");
      }
      setSearchParams(next, { replace });
    },
    [searchParams, setSearchParams],
  );

  const openArchivedSession = useCallback(
    (archive: ArchivedSessionItem) => {
      closeStream();
      setMessages(archive.messages);
      setThreadId(archive.threadId);
      setSessionId(archive.sessionId);
      setActiveRunId(null);
      setActiveRunStatus(null);
      persistActiveRun(null);
      syncSessionQuery(archive.sessionId, false);
      setIsSessionPanelOpen(false);
      focusDraftInput();
    },
    [closeStream, focusDraftInput, persistActiveRun, syncSessionQuery],
  );

  const scrollToBottom = useCallback(() => {
    window.requestAnimationFrame(() => {
      const container = messageViewportRef.current;
      if (!container) return;
      container.scrollTop = container.scrollHeight;
    });
  }, []);

  const upsertRunMessages = useCallback(
    (params: {
      runId: string;
      message: string;
      createdAt: string;
      partialAnswer?: string | null;
      finalAnswer?: string | null;
      isError?: boolean;
      result?: AgentQueryResult | null;
    }) => {
      const {
        runId,
        message,
        createdAt,
        partialAnswer,
        finalAnswer,
        isError,
        result,
      } = params;
      const assistantText = (finalAnswer || partialAnswer || "").trim();
      setMessages((previous) => {
        const next = [...previous];
        const userIdx = next.findIndex(
          (item) => item.runId === runId && item.role === "user",
        );
        if (userIdx < 0) {
          next.push({
            id: toClientId("u"),
            role: "user",
            content: message,
            createdAt,
            runId,
          });
        }
        const assistantIdx = next.findIndex(
          (item) => item.runId === runId && item.role === "assistant",
        );
        if (assistantIdx < 0) {
          next.push({
            id: toClientId("a"),
            role: "assistant",
            content: assistantText,
            createdAt,
            runId,
            isError,
            result: result || undefined,
          });
        } else {
          const current = next[assistantIdx];
          next[assistantIdx] = {
            ...current,
            content: assistantText || current.content,
            isError: typeof isError === "boolean" ? isError : current.isError,
            result: result || current.result,
          };
        }
        return next;
      });
    },
    [],
  );

  const connectRunStream = useCallback(
    (runId: string) => {
      closeStream();
      const stream = agentsApi.openRunStream(runId, lastEventIdRef.current);
      eventSourceRef.current = stream;

      stream.addEventListener("snapshot", (event: MessageEvent) => {
        const data = parseEventData(event.data);
        const status = String(data.status || "");
        if (
          status === "queued" ||
          status === "running" ||
          status === "completed" ||
          status === "failed" ||
          status === "cancelled"
        ) {
          setActiveRunStatus(status);
        }
      });

      stream.addEventListener("status", (event: MessageEvent) => {
        const data = parseEventData(event.data);
        const status = String(data.status || "");
        if (
          status === "queued" ||
          status === "running" ||
          status === "completed" ||
          status === "failed" ||
          status === "cancelled"
        ) {
          setActiveRunStatus(status);
          if (isTerminalStatus(status)) {
            persistActiveRun(null);
          }
        }
        const lastEventId = Number(event.lastEventId || 0);
        if (Number.isFinite(lastEventId) && lastEventId > 0) {
          lastEventIdRef.current = lastEventId;
        }
      });

      stream.addEventListener("delta", (event: MessageEvent) => {
        const data = parseEventData(event.data);
        const accumulated = String(data.accumulated || "");
        setMessages((previous) => {
          const next = [...previous];
          const assistantIdx = next.findIndex(
            (item) => item.runId === runId && item.role === "assistant",
          );
          if (assistantIdx >= 0) {
            next[assistantIdx] = {
              ...next[assistantIdx],
              content: accumulated,
              isError: false,
            };
          }
          return next;
        });
        const lastEventId = Number(event.lastEventId || 0);
        if (Number.isFinite(lastEventId) && lastEventId > 0) {
          lastEventIdRef.current = lastEventId;
        }
        scrollToBottom();
      });

      stream.addEventListener("result", (event: MessageEvent) => {
        const data = parseEventData(event.data);
        const response = normalizeQueryResult(data.response);
        if (response) {
          setMessages((previous) => {
            const next = [...previous];
            const assistantIdx = next.findIndex(
              (item) => item.runId === runId && item.role === "assistant",
            );
            if (assistantIdx >= 0) {
              next[assistantIdx] = {
                ...next[assistantIdx],
                content: response.final_answer || next[assistantIdx].content,
                result: response,
                isError: false,
              };
            }
            return next;
          });
          setThreadId(response.thread_id);
          setSessionId(response.session_id);
          syncSessionQuery(response.session_id, true);
        }
        const lastEventId = Number(event.lastEventId || 0);
        if (Number.isFinite(lastEventId) && lastEventId > 0) {
          lastEventIdRef.current = lastEventId;
        }
      });

      stream.addEventListener("error", (event: MessageEvent) => {
        const data = parseEventData(event.data);
        const message =
          String(data.message || "").trim() ||
          "AI gặp lỗi trong quá trình thực thi.";
        setMessages((previous) => {
          const next = [...previous];
          const assistantIdx = next.findIndex(
            (item) => item.runId === runId && item.role === "assistant",
          );
          if (assistantIdx >= 0) {
            next[assistantIdx] = {
              ...next[assistantIdx],
              content: message,
              isError: true,
            };
          }
          return next;
        });
        setActiveRunStatus("failed");
        persistActiveRun(null);
        closeStream();
      });

      stream.addEventListener("cancelled", () => {
        setActiveRunStatus("cancelled");
        persistActiveRun(null);
      });

      stream.addEventListener("done", () => {
        closeStream();
        setActiveRunId(null);
        persistActiveRun(null);
      });

      stream.onerror = () => {
        stream.close();
        eventSourceRef.current = null;
        if (!isTerminalStatus(activeRunStatusRef.current)) {
          reconnectTimerRef.current = window.setTimeout(() => {
            connectRunStream(runId);
          }, 900);
        }
      };
    },
    [closeStream, persistActiveRun, scrollToBottom, syncSessionQuery],
  );

  const resumeRun = useCallback(
    async (runId: string) => {
      const statusData = await agentsApi.getRun(runId);
      setActiveRunId(runId);
      setActiveRunStatus(statusData.status);
      persistActiveRun(isTerminalStatus(statusData.status) ? null : runId);
      setThreadId(statusData.thread_id);
      setSessionId(statusData.session_id);
      syncSessionQuery(statusData.session_id, true);
      upsertRunMessages({
        runId,
        message: statusData.message,
        createdAt: statusData.created_at,
        partialAnswer: statusData.partial_answer,
        finalAnswer: statusData.final_answer,
        isError: statusData.status === "failed",
        result: normalizeQueryResult(statusData.result),
      });
      const latest = Number(statusData.latest_event_id || 0);
      if (Number.isFinite(latest) && latest > 0) {
        lastEventIdRef.current = latest;
      }
      if (!isTerminalStatus(statusData.status)) {
        connectRunStream(runId);
      }
    },
    [connectRunStream, persistActiveRun, syncSessionQuery, upsertRunMessages],
  );

  const handleSubmitPrompt = useCallback(
    async (prompt?: string) => {
      const content = (prompt ?? draft).trim();
      if (!content) {
        toast.error("Hãy nhập nội dung cần AI xử lý.");
        return;
      }
      if (!canUseAgent) {
        toast.error(
          "Bạn không thể dùng AI ở workspace hiện tại. Hãy chuyển sang workspace team Business hoặc kiểm tra quyền.",
        );
        return;
      }
      if (isRunExecuting) {
        toast.error(
          "Đang có một phiên AI chạy. Hãy dừng trước khi gửi yêu cầu mới.",
        );
        return;
      }

      setStartingRun(true);
      setDraft("");
      try {
        const started = await agentsApi.startRun({
          message: content,
          thread_id: threadId || undefined,
          session_id: sessionId,
          locale: "vi-VN",
          execution_mode: executionMode,
          model_tier: modelTier,
        });

        lastEventIdRef.current = 0;
        setThreadId(started.thread_id);
        setSessionId(started.session_id);
        syncSessionQuery(started.session_id, true);

        setActiveRunId(started.run_id);
        setActiveRunStatus(started.status);
        persistActiveRun(started.run_id);

        upsertRunMessages({
          runId: started.run_id,
          message: content,
          createdAt: started.created_at,
          partialAnswer: "",
        });
        connectRunStream(started.run_id);
        scrollToBottom();
      } catch (error) {
        const message = getErrorMessage(error, "Không thể bắt đầu phiên AI.");
        toast.error(message);
      } finally {
        setStartingRun(false);
        focusDraftInput();
      }
    },
    [
      canUseAgent,
      connectRunStream,
      draft,
      executionMode,
      focusDraftInput,
      isRunExecuting,
      modelTier,
      persistActiveRun,
      scrollToBottom,
      sessionId,
      threadId,
      syncSessionQuery,
      upsertRunMessages,
    ],
  );

  const handleCancelRun = useCallback(async () => {
    if (!activeRunId || !isRunExecuting) return;
    setCancellingRun(true);
    try {
      const result = await agentsApi.cancelRun(activeRunId);
      setActiveRunStatus(result.status);
      if (result.status === "cancelled") {
        persistActiveRun(null);
        closeStream();
        setActiveRunId(null);
        setMessages((previous) => {
          const next = [...previous];
          const assistantIdx = next.findIndex(
            (item) => item.runId === activeRunId && item.role === "assistant",
          );
          if (assistantIdx >= 0) {
            next[assistantIdx] = {
              ...next[assistantIdx],
              content:
                next[assistantIdx].content.trim() ||
                "Đã dừng phiên AI theo yêu cầu.",
              isError: false,
            };
          }
          return next;
        });
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Không thể dừng phiên AI."));
    } finally {
      setCancellingRun(false);
      focusDraftInput();
    }
  }, [
    activeRunId,
    closeStream,
    focusDraftInput,
    isRunExecuting,
    persistActiveRun,
  ]);

  function resetConversation(): void {
    closeStream();
    setMessages([]);
    setThreadId(null);
    setActiveRunId(null);
    setActiveRunStatus(null);
    persistActiveRun(null);
    longThreadWarnedRef.current = "";
    const nextSessionId = toClientId("session");
    setSessionId(nextSessionId);
    syncSessionQuery(nextSessionId, false);
    setIsSessionPanelOpen(false);
    focusDraftInput();
  }

  useEffect(() => {
    closeStream();
    setIsSessionPanelOpen(false);
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const history = await agentsApi.listRunHistory({
          workspace_key: workspaceKey,
          limit: 300,
        });
        if (cancelled) return;

        const rows = Array.isArray(history.items) ? history.items : [];
        const archives = buildSessionArchivesFromRuns(rows).slice(
          0,
          MAX_ARCHIVE_SESSIONS,
        );
        setSessionArchives(archives);

        const selectedArchive = requestedSessionId
          ? (archives.find((item) => item.sessionId === requestedSessionId) ??
            null)
          : (archives[0] ?? null);

        if (!selectedArchive) {
          const nextSessionId = requestedSessionId || toClientId("session");
          setMessages([]);
          setThreadId(null);
          setSessionId(nextSessionId);
          setActiveRunId(null);
          setActiveRunStatus(null);
          persistActiveRun(null);
          syncSessionQuery(nextSessionId, true);
          return;
        }

        setMessages(selectedArchive.messages);
        setThreadId(selectedArchive.threadId);
        setSessionId(selectedArchive.sessionId);
        if (selectedArchive.sessionId !== requestedSessionId) {
          syncSessionQuery(selectedArchive.sessionId, true);
        }

        const selectedRuns = rows.filter(
          (item) => item.session_id === selectedArchive.sessionId,
        );
        const latestActive = getLatestActiveRun(selectedRuns);
        if (latestActive?.run_id) {
          await resumeRun(latestActive.run_id);
        } else {
          setActiveRunId(null);
          setActiveRunStatus(null);
          persistActiveRun(null);
        }
      } catch (error) {
        if (cancelled) return;
        setSessionArchives([]);
        setMessages([]);
        setThreadId(null);
        setActiveRunId(null);
        setActiveRunStatus(null);
        const nextSessionId = requestedSessionId || toClientId("session");
        setSessionId(nextSessionId);
        syncSessionQuery(nextSessionId, true);
        toast.error(
          getErrorMessage(error, "Không thể tải lịch sử hội thoại AI."),
        );
      }
    };
    void bootstrap();

    return () => {
      cancelled = true;
      closeStream();
    };
  }, [
    closeStream,
    persistActiveRun,
    requestedSessionId,
    resumeRun,
    syncSessionQuery,
    workspaceKey,
  ]);

  useEffect(() => {
    const query = (searchParams.get("q") || "").trim();
    const auto = searchParams.get("auto") === "1";
    const token = `${searchParams.get("t") || query}|${workspaceKey}`;
    if (!query || !auto) return;
    if (autoSentTokenRef.current === token) return;
    autoSentTokenRef.current = token;
    setDraft(query);
    void handleSubmitPrompt(query);

    const next = new URLSearchParams(searchParams);
    next.delete("q");
    next.delete("auto");
    next.delete("t");
    setSearchParams(next, { replace: true });
  }, [handleSubmitPrompt, searchParams, setSearchParams, workspaceKey]);

  useEffect(() => {
    if (!sessionId) return;
    setSessionArchives((previous) => {
      const remaining = previous.filter((item) => item.sessionId !== sessionId);
      if (messages.length === 0) {
        return remaining;
      }
      const nextItem: ArchivedSessionItem = {
        sessionId,
        threadId,
        title: buildSessionTitle(messages),
        updatedAt:
          messages[messages.length - 1]?.createdAt || new Date().toISOString(),
        messageCount: messages.length,
        messages: [...messages],
      };
      return [nextItem, ...remaining]
        .sort(
          (left, right) => toEpoch(right.updatedAt) - toEpoch(left.updatedAt),
        )
        .slice(0, MAX_ARCHIVE_SESSIONS);
    });
  }, [messages, sessionId, threadId]);

  useEffect(() => {
    if (!shouldRecommendNewThread) {
      return;
    }
    const conversationKey = `${threadId || sessionId || "default"}`;
    if (longThreadWarnedRef.current === conversationKey) {
      return;
    }
    longThreadWarnedRef.current = conversationKey;
    toast.warning(
      "Phiên trò chuyện đã dài. Bạn nên tạo phiên mới để AI trả lời ổn định hơn.",
    );
  }, [sessionId, shouldRecommendNewThread, threadId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="mt-0.5"
            onClick={() => setIsSessionPanelOpen((prev) => !prev)}
            aria-label="Mở danh sách phiên trả lời"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Bot className="h-5 w-5 text-primary" />
              AI xử lý công việc
            </h1>
            <p className="text-sm text-muted-foreground">
              Hỗ trợ streaming realtime, dừng run và resume sau khi refresh/trở
              lại trang.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Workspace:{" "}
          <span className="font-semibold text-foreground">
            {workspaceLabel}
          </span>
          {threadId ? (
            <span className="ml-2 text-muted-foreground">
              Thread: {threadId}
            </span>
          ) : null}
        </div>
      </div>

      {!canUseAgent ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="py-4 text-sm text-foreground">
            <p className="font-medium">
              AI chưa khả dụng trong ngữ cảnh hiện tại.
            </p>
            <p className="mt-1 text-muted-foreground">
              Điều kiện cần: đang ở workspace team thuộc gói Business và có
              quyền truy cập AI agent.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-4">
        {isSessionPanelOpen ? (
          <aside className="hidden w-[290px] shrink-0 rounded-lg border border-border/70 bg-background p-3 lg:flex lg:flex-col lg:gap-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                Phiên trả lời
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={resetConversation}
                disabled={isRunExecuting || startingRun}
              >
                Phiên mới
              </Button>
            </div>
            <div className="max-h-[calc(100vh-280px)] space-y-2 overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setIsSessionPanelOpen(false)}
                className="w-full rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-left"
              >
                <p className="text-xs font-semibold text-foreground">
                  Phiên hiện tại
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {threadId || sessionId}
                </p>
              </button>
              {visibleArchives.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                  Chưa có phiên lưu trữ.
                </p>
              ) : (
                visibleArchives.map((archive) => (
                  <button
                    key={archive.sessionId}
                    type="button"
                    onClick={() => openArchivedSession(archive)}
                    className="w-full rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-left transition hover:bg-muted/40"
                  >
                    <p className="line-clamp-2 text-xs font-semibold text-foreground">
                      {archive.title}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTime(archive.updatedAt)} •{" "}
                      {archive.messageCount} tin nhắn
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>
        ) : null}

        <div className="grid min-w-0 flex-1 gap-4 xl:grid-cols-12">
          <Card className="flex h-[calc(100vh-220px)] min-h-[560px] flex-col overflow-hidden col-span-9">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hội thoại AI</CardTitle>
              <p className="text-xs text-muted-foreground">
                Phiên:{" "}
                <span className="font-medium text-foreground">
                  {threadId || sessionId}
                </span>
              </p>
            </CardHeader>
            <CardContent className="min-h-0 flex flex-1 flex-col p-0">
              {shouldRecommendNewThread ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-300">
                  <span className="inline-flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Phiên chat đã dài, bạn nên tạo phiên mới để tránh loãng ngữ
                    cảnh.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={resetConversation}
                    disabled={isRunExecuting || startingRun}
                  >
                    Tạo phiên mới
                  </Button>
                </div>
              ) : null}

              <div
                ref={messageViewportRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden bg-muted/20 px-4 py-4"
              >
                {messages.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-background/80 p-3 text-sm text-muted-foreground">
                    Gợi ý: hỏi KPI, thành viên team, trạng thái phòng theo chi
                    nhánh hoặc hóa đơn kỳ hạn theo khách hàng/mã hợp đồng.
                  </div>
                ) : null}

                {messages.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-lg border p-3 ${
                      item.role === "user"
                        ? "ml-auto max-w-[92%] border-primary/40 bg-primary/5"
                        : item.isError
                          ? "mr-auto max-w-[92%] border-destructive/40 bg-destructive/5"
                          : "mr-auto max-w-[92%] border-border bg-background"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold">
                        {item.role === "user" ? "Bạn" : "AI Agent"}
                      </span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                    <MarkdownMessage content={item.content} />

                    {item.result ? (
                      <div className="mt-3 space-y-2 rounded-md border border-border/70 bg-muted/30 p-2.5">
                        <p className="text-xs font-semibold text-foreground">
                          Metadata phiên xử lý
                        </p>
                        <div className="grid gap-1 text-[12px] text-muted-foreground sm:grid-cols-2">
                          <p>
                            Intent:{" "}
                            <span className="font-medium text-foreground">
                              {item.result.intent || "--"}
                            </span>
                          </p>
                          <p>
                            Route:{" "}
                            <span className="font-medium text-foreground">
                              {item.result.route || "--"}
                            </span>
                          </p>
                          <p>
                            Mode:{" "}
                            <span className="font-medium text-foreground">
                              {item.result.execution_mode || "--"}
                            </span>
                          </p>
                          <p>
                            Approval:{" "}
                            <span className="font-medium text-foreground">
                              {item.result.requires_approval ? "Có" : "Không"}
                            </span>
                          </p>
                          <p>
                            Tool calls:{" "}
                            <span className="font-medium text-foreground">
                              {getToolCallCount(item.result)}
                            </span>
                          </p>
                          <p>
                            Allowed tools:{" "}
                            <span className="font-medium text-foreground">
                              {getAllowedToolsCount(item.result)}
                            </span>
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}

                {isRunExecuting ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI đang xử lý... (Run: {activeRunId || "--"})
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-border/70 bg-background px-4 py-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Chế độ thực thi
                    </label>
                    <select
                      value={executionMode}
                      onChange={(event) =>
                        setExecutionMode(
                          event.target.value as AgentExecutionMode,
                        )
                      }
                      className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={isRunExecuting}
                    >
                      {EXECUTION_MODE_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Model
                    </label>
                    <select
                      value={modelTier}
                      onChange={(event) =>
                        setModelTier(event.target.value as AgentModelTier)
                      }
                      className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                      disabled={isRunExecuting}
                    >
                      {MODEL_TIER_OPTIONS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <textarea
                  ref={draftInputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (isRunExecuting) {
                        void handleCancelRun();
                      } else {
                        void handleSubmitPrompt();
                      }
                    }
                  }}
                  placeholder="Nhập yêu cầu AI... (Enter gửi, Shift+Enter xuống dòng)"
                  rows={4}
                  className="min-h-[116px] w-full resize-y rounded-md border border-input bg-background px-3 py-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={startingRun || cancellingRun || !canUseAgent}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Trạng thái run:{" "}
                    <span className="font-semibold text-foreground">
                      {activeRunStatus || "idle"}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetConversation}
                      disabled={isRunExecuting || startingRun}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Phiên mới
                    </Button>
                    {isRunExecuting ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => void handleCancelRun()}
                        disabled={cancellingRun}
                      >
                        {cancellingRun ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <PauseCircle className="mr-2 h-4 w-4" />
                        )}
                        Dừng
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={() => void handleSubmitPrompt()}
                        disabled={startingRun || !canUseAgent}
                      >
                        {startingRun ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <PlayCircle className="mr-2 h-4 w-4" />
                        )}
                        Gửi cho AI
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4 col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tác vụ nhanh</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {QUICK_PROMPTS.map((item) => (
                  <Button
                    key={item.label}
                    type="button"
                    variant="outline"
                    className="w-full justify-start whitespace-normal text-left"
                    disabled={startingRun || !canUseAgent || isRunExecuting}
                    onClick={() => void handleSubmitPrompt(item.prompt)}
                  >
                    {item.label}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
