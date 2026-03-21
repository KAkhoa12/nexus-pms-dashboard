import type { ApiEnvelope } from "@/features/auth/types";
import { httpClient } from "@/services/http/client";

export type ChatAttachment = {
  file_name: string;
  file_url: string;
  mime_type: string | null;
  size_bytes: number | null;
};

export type ChatChannel = {
  id: number;
  team_id: number | null;
  name: string;
  is_group: boolean;
  is_active: boolean;
  member_user_ids: number[];
  unread_count: number;
  last_message_id: number | null;
  last_message_content: string | null;
  last_message_at: string | null;
  created_at: string;
};

export type ChatMessage = {
  id: number;
  channel_id: number;
  sender_user_id: number | null;
  message_type: string;
  content: string;
  reply_to_message_id: number | null;
  attachments: ChatAttachment[];
  created_at: string;
};

export type ChatTypingState = {
  user_id: number;
  full_name: string;
  avatar_url: string | null;
  is_typing: boolean;
  last_typed_at: string | null;
  expires_at: string | null;
};

export type ChatUploadResult = {
  file_name: string;
  file_url: string;
  mime_type: string | null;
  size_bytes: number;
  is_image: boolean;
};

export type PresenceState = {
  user_id: number;
  is_online: boolean;
  updated_at: string | null;
};

function unwrapResponse<T>(data: ApiEnvelope<T>, fallbackMessage: string): T {
  if (!data.response) {
    throw new Error(data.message || fallbackMessage);
  }
  return data.response;
}

export const teamChatApi = {
  async listChannels(): Promise<ChatChannel[]> {
    const { data } = await httpClient.get<ApiEnvelope<ChatChannel[]>>(
      "/collaboration/chat/channels",
    );
    return unwrapResponse(data, "Không thể tải danh sách nhóm chat.");
  },

  async createChannel(payload: {
    name: string;
    team_id: number;
    is_group: boolean;
    member_user_ids: number[];
  }): Promise<ChatChannel> {
    const { data } = await httpClient.post<ApiEnvelope<ChatChannel>>(
      "/collaboration/chat/channels",
      payload,
    );
    return unwrapResponse(data, "Không thể tạo kênh chat.");
  },

  async listMessages(channelId: number): Promise<ChatMessage[]> {
    const { data } = await httpClient.get<ApiEnvelope<ChatMessage[]>>(
      `/collaboration/chat/channels/${channelId}/messages`,
    );
    return unwrapResponse(data, "Không thể tải lịch sử chat.");
  },

  async sendMessage(payload: {
    channel_id: number;
    content: string;
    message_type?: string;
    attachments?: ChatAttachment[];
  }): Promise<ChatMessage> {
    const { data } = await httpClient.post<ApiEnvelope<ChatMessage>>(
      `/collaboration/chat/channels/${payload.channel_id}/messages`,
      {
        content: payload.content,
        message_type: payload.message_type || "TEXT",
        attachments: payload.attachments || [],
      },
    );
    return unwrapResponse(data, "Không thể gửi tin nhắn.");
  },

  async uploadChatFile(file: File): Promise<ChatUploadResult> {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await httpClient.post<ApiEnvelope<ChatUploadResult>>(
      "/collaboration/chat/uploads",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return unwrapResponse(data, "Không thể tải file chat.");
  },

  async updateTyping(channelId: number, isTyping: boolean): Promise<void> {
    await httpClient.put<ApiEnvelope<ChatTypingState>>(
      `/collaboration/chat/channels/${channelId}/typing`,
      { is_typing: isTyping },
    );
  },

  async listTyping(channelId: number): Promise<ChatTypingState[]> {
    const { data } = await httpClient.get<ApiEnvelope<ChatTypingState[]>>(
      `/collaboration/chat/channels/${channelId}/typing`,
    );
    return unwrapResponse(data, "Không thể tải trạng thái đang gõ.");
  },

  async heartbeatPresence(isOnline: boolean): Promise<void> {
    await httpClient.post<ApiEnvelope<PresenceState>>(
      "/collaboration/chat/presence/heartbeat",
      { is_online: isOnline },
    );
  },

  async listPresence(teamId?: number): Promise<PresenceState[]> {
    const { data } = await httpClient.get<ApiEnvelope<PresenceState[]>>(
      "/collaboration/chat/presence",
      {
        params: teamId ? { team_id: teamId } : undefined,
      },
    );
    return unwrapResponse(data, "Không thể tải trạng thái online.");
  },
};
