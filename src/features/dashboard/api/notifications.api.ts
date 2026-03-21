import type { ApiEnvelope } from "@/features/auth/types";
import { httpClient } from "@/services/http/client";

export type NotificationItem = {
  id: number;
  team_id: number | null;
  title: string;
  body: string;
  notification_type: string;
  created_by_user_id: number | null;
  published_at: string;
  is_read: boolean;
  read_at: string | null;
};

export type CreateNotificationPayload = {
  title: string;
  body: string;
  notification_type: "SYSTEM" | "ALL_USERS" | "SELECTED_USERS";
  team_id?: number | null;
  recipient_user_ids?: number[];
};

function unwrapResponse<T>(data: ApiEnvelope<T>, fallbackMessage: string): T {
  if (!data.response) {
    throw new Error(data.message || fallbackMessage);
  }
  return data.response;
}

export const notificationsApi = {
  async list(): Promise<NotificationItem[]> {
    const { data } = await httpClient.get<ApiEnvelope<NotificationItem[]>>(
      "/collaboration/notifications",
    );
    return unwrapResponse(data, "Không thể tải danh sách thông báo.");
  },

  async markRead(notificationId: number): Promise<NotificationItem> {
    const { data } = await httpClient.patch<ApiEnvelope<NotificationItem>>(
      `/collaboration/notifications/${notificationId}/read`,
    );
    return unwrapResponse(data, "Không thể đánh dấu đã đọc.");
  },

  async create(payload: CreateNotificationPayload): Promise<NotificationItem> {
    const { data } = await httpClient.post<ApiEnvelope<NotificationItem>>(
      "/collaboration/notifications",
      payload,
    );
    return unwrapResponse(data, "Không thể tạo thông báo.");
  },
};
