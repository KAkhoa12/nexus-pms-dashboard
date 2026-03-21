import { getAccessToken } from "@/services/auth/token";

export type CollaborationRealtimeEvent = {
  type: string;
  channel?: string;
  payload?: Record<string, unknown>;
};

type ConnectRealtimeOptions = {
  workspaceKey: string;
  onEvent: (event: CollaborationRealtimeEvent) => void;
  onConnectedChange?: (connected: boolean) => void;
};

type RealtimeSocketHandle = {
  close: () => void;
  send: (payload: Record<string, unknown>) => void;
};

function buildWebSocketUrl(token: string, workspaceKey: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api/v1`;
  const parsed = new URL(baseUrl, window.location.origin);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  const normalizedPath =
    parsed.pathname && parsed.pathname !== "/"
      ? parsed.pathname.replace(/\/$/, "")
      : "/api/v1";
  const wsUrl = new URL(`${protocol}//${parsed.host}${normalizedPath}/collaboration/ws`);
  wsUrl.searchParams.set("token", token);
  wsUrl.searchParams.set("workspace_key", workspaceKey || "personal");
  return wsUrl.toString();
}

export function connectCollaborationRealtimeSocket(
  options: ConnectRealtimeOptions,
): RealtimeSocketHandle {
  let socket: WebSocket | null = null;
  let manuallyClosed = false;
  let reconnectTimer: number | null = null;
  let heartbeatTimer: number | null = null;
  let reconnectAttempt = 0;

  const clearTimers = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (heartbeatTimer !== null) {
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const send = (payload: Record<string, unknown>) => {
    if (socket?.readyState !== WebSocket.OPEN) {
      return;
    }
    socket.send(JSON.stringify(payload));
  };

  const scheduleReconnect = () => {
    if (manuallyClosed || reconnectTimer !== null) {
      return;
    }
    reconnectAttempt += 1;
    const delayMs = Math.min(1000 * 2 ** Math.min(reconnectAttempt, 4), 10000);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delayMs);
  };

  const connect = () => {
    if (manuallyClosed) {
      return;
    }
    const token = getAccessToken();
    if (!token) {
      options.onConnectedChange?.(false);
      return;
    }

    socket = new WebSocket(buildWebSocketUrl(token, options.workspaceKey));
    socket.onopen = () => {
      reconnectAttempt = 0;
      options.onConnectedChange?.(true);
      clearTimers();
      heartbeatTimer = window.setInterval(() => {
        send({ type: "ping" });
      }, 25000);
    };
    socket.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as CollaborationRealtimeEvent;
        if (parsed && parsed.type) {
          options.onEvent(parsed);
        }
      } catch {
        // ignore malformed realtime payload
      }
    };
    socket.onerror = () => {
      options.onConnectedChange?.(false);
    };
    socket.onclose = () => {
      options.onConnectedChange?.(false);
      clearTimers();
      scheduleReconnect();
    };
  };

  connect();

  return {
    close: () => {
      manuallyClosed = true;
      clearTimers();
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
      socket = null;
      options.onConnectedChange?.(false);
    },
    send,
  };
}
