import { httpClient } from "@/services/http/client";
import type { ApiEnvelope } from "@/features/auth/types";
import type {
  Team,
  TeamMember,
  TeamMemberCandidate,
} from "@/features/teams/types";

type TeamActionResult = {
  success: boolean;
  message: string;
};

export const teamsApi = {
  async getMyTeams(): Promise<Team[]> {
    const { data } = await httpClient.get<ApiEnvelope<Team[]>>("/teams/me");
    if (!data.response) {
      throw new Error(data.message || "Không thể tải danh sách team.");
    }
    return data.response;
  },

  async createTeam(payload: {
    name: string;
    description?: string;
  }): Promise<Team> {
    const { data } = await httpClient.post<ApiEnvelope<Team>>(
      "/teams",
      payload,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể tạo workspace team.");
    }
    return data.response;
  },

  async deleteTeam(teamId: number): Promise<TeamActionResult> {
    const { data } = await httpClient.delete<ApiEnvelope<TeamActionResult>>(
      `/teams/${teamId}`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể xóa workspace team.");
    }
    return data.response;
  },

  async inviteMember(payload: {
    teamId: number;
    email: string;
    rbacRoleId: number | null;
  }): Promise<TeamMember> {
    const { data } = await httpClient.post<ApiEnvelope<TeamMember>>(
      `/teams/${payload.teamId}/members`,
      {
        email: payload.email,
        rbac_role_id: payload.rbacRoleId,
      },
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể thêm thành viên vào team.");
    }
    return data.response;
  },

  async updateMemberRole(payload: {
    teamId: number;
    memberUserId: number;
    rbacRoleId: number;
  }): Promise<TeamMember> {
    const { data } = await httpClient.patch<ApiEnvelope<TeamMember>>(
      `/teams/${payload.teamId}/members/${payload.memberUserId}/rbac-role`,
      {
        rbac_role_id: payload.rbacRoleId,
      },
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể cập nhật vai trò thành viên.");
    }
    return data.response;
  },

  async kickMember(payload: {
    teamId: number;
    memberUserId: number;
  }): Promise<TeamActionResult> {
    const { data } = await httpClient.delete<ApiEnvelope<TeamActionResult>>(
      `/teams/${payload.teamId}/members/${payload.memberUserId}`,
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể loại thành viên khỏi team.");
    }
    return data.response;
  },

  async searchMemberCandidates(payload: {
    teamId: number;
    query?: string;
    limit?: number;
  }): Promise<TeamMemberCandidate[]> {
    const { data } = await httpClient.get<ApiEnvelope<TeamMemberCandidate[]>>(
      `/teams/${payload.teamId}/member-candidates`,
      {
        params: {
          query: payload.query ?? "",
          limit: payload.limit ?? 50,
        },
      },
    );
    if (!data.response) {
      throw new Error(data.message || "Không thể tìm kiếm nhân viên.");
    }
    return data.response;
  },
};
