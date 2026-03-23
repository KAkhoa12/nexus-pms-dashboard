import type { ApiEnvelope } from "@/features/auth/types";
import { getAccessToken } from "@/services/auth/token";
import { httpClient } from "@/services/http/client";
import { storage } from "@/services/storage";

export type AgentExecutionMode =
  | "read_only"
  | "propose_write"
  | "approved_write";

export type AgentModelTier = "standard" | "cheap";

export type AgentRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentQueryPayload = {
  message: string;
  thread_id?: string;
  session_id?: string;
  locale?: string;
  execution_mode?: AgentExecutionMode;
  model_tier?: AgentModelTier;
};

export type AgentToolResult = {
  tool_name: string;
  ok: boolean;
  payload: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
};

export type AgentAuditEvent = {
  ts: string;
  graph: string;
  node: string;
  event: string;
  metadata: Record<string, unknown>;
};

export type AgentRuntimeContext = {
  request_id: string;
  tenant_id: number;
  user_id: number;
  role_ids: string[];
  permission_codes: string[];
  has_full_access: boolean;
  locale: string;
  thread_id: string;
  session_id: string;
  allowed_tools: string[];
  execution_mode: AgentExecutionMode;
  approval_required: boolean;
  model_tier: string;
  timeout_seconds: number;
  retry_limit: number;
  max_tool_calls: number;
  cost_budget_usd: number;
  memory_namespace: string;
};

export type AgentQueryResult = {
  request_id: string;
  thread_id: string;
  session_id: string;
  intent: string;
  route: string;
  execution_mode: AgentExecutionMode;
  requires_approval: boolean;
  final_answer: string;
  risk_flags: string[];
  task_plan: string[];
  tool_results: AgentToolResult[];
  audit_trail: AgentAuditEvent[];
  runtime_context: AgentRuntimeContext;
};

export type AgentCheckpointItem = {
  id: number;
  graph_name: string;
  node_name: string;
  created_at: string;
};

export type AgentCheckpointList = {
  thread_id: string;
  items: AgentCheckpointItem[];
};

export type AgentRunPayload = {
  message: string;
  thread_id?: string;
  session_id?: string;
  locale?: string;
  execution_mode?: AgentExecutionMode;
  model_tier?: AgentModelTier;
};

export type AgentRunStartResult = {
  run_id: string;
  status: AgentRunStatus;
  thread_id: string;
  session_id: string;
  created_at: string;
};

export type AgentRunStatusResult = {
  run_id: string;
  status: AgentRunStatus;
  thread_id: string;
  session_id: string;
  request_id: string;
  message: string;
  locale: string;
  execution_mode: AgentExecutionMode;
  model_tier: string;
  cancel_requested: boolean;
  partial_answer: string | null;
  final_answer: string | null;
  error_message: string | null;
  result: Record<string, unknown> | null;
  latest_event_id: number | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type AgentRunListResult = {
  items: AgentRunStatusResult[];
};

export type AgentRunHistoryQuery = {
  limit?: number;
  workspace_key?: string;
  session_id?: string;
  thread_id?: string;
};

export type AgentRunCancelResult = {
  run_id: string;
  status: AgentRunStatus;
  cancel_requested: boolean;
};

function unwrapResponse<T>(data: ApiEnvelope<T>, fallbackMessage: string): T {
  if (!data.response) {
    throw new Error(data.message || fallbackMessage);
  }
  return data.response;
}

function buildApiUrl(path: string): string {
  const baseRaw = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  const base = baseRaw.endsWith("/") ? baseRaw.slice(0, -1) : baseRaw;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export const agentsApi = {
  async query(payload: AgentQueryPayload): Promise<AgentQueryResult> {
    const { data } = await httpClient.post<ApiEnvelope<AgentQueryResult>>(
      "/agents/query",
      payload,
    );
    return unwrapResponse(data, "Không thể xử lý truy vấn AI.");
  },

  async listCheckpoints(
    threadId: string,
    limit = 30,
  ): Promise<AgentCheckpointList> {
    const { data } = await httpClient.get<ApiEnvelope<AgentCheckpointList>>(
      `/agents/threads/${threadId}/checkpoints`,
      { params: { limit } },
    );
    return unwrapResponse(data, "Không thể tải checkpoint của AI.");
  },

  async startRun(payload: AgentRunPayload): Promise<AgentRunStartResult> {
    const { data } = await httpClient.post<ApiEnvelope<AgentRunStartResult>>(
      "/agents/runs/start",
      payload,
    );
    return unwrapResponse(data, "Không thể tạo phiên chạy AI.");
  },

  async getRun(runId: string): Promise<AgentRunStatusResult> {
    const { data } = await httpClient.get<ApiEnvelope<AgentRunStatusResult>>(
      `/agents/runs/${runId}`,
    );
    return unwrapResponse(data, "Không thể tải trạng thái phiên AI.");
  },

  async listActiveRuns(limit = 10): Promise<AgentRunListResult> {
    const { data } = await httpClient.get<ApiEnvelope<AgentRunListResult>>(
      "/agents/runs/active",
      { params: { limit } },
    );
    return unwrapResponse(data, "Không thể tải các phiên AI đang chạy.");
  },

  async listRunHistory(
    query: AgentRunHistoryQuery = {},
  ): Promise<AgentRunListResult> {
    const { data } = await httpClient.get<ApiEnvelope<AgentRunListResult>>(
      "/agents/runs/history",
      { params: query },
    );
    return unwrapResponse(data, "Không thể tải lịch sử phiên AI.");
  },

  async cancelRun(runId: string): Promise<AgentRunCancelResult> {
    const { data } = await httpClient.post<ApiEnvelope<AgentRunCancelResult>>(
      `/agents/runs/${runId}/cancel`,
    );
    return unwrapResponse(data, "Không thể dừng phiên AI.");
  },

  openRunStream(runId: string, lastEventId = 0): EventSource {
    const token = getAccessToken();
    const workspaceKey = storage.get("active_workspace_key") || "personal";
    const params = new URLSearchParams();
    if (token) {
      params.set("token", token);
    }
    if (workspaceKey) {
      params.set("workspace_key", workspaceKey);
    }
    if (lastEventId > 0) {
      params.set("last_event_id", `${lastEventId}`);
    }
    const queryString = params.toString();
    const url = buildApiUrl(
      `/agents/runs/${runId}/stream${queryString ? `?${queryString}` : ""}`,
    );
    return new EventSource(url);
  },
};
