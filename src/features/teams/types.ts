export type TeamMember = {
  id: number;
  user_id: number;
  email: string;
  full_name: string;
  member_role: string;
  rbac_role_id: number | null;
  invited_by_user_id: number | null;
  created_at: string;
};

export type Team = {
  id: number;
  tenant_id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  owner_user_id: number;
  owner_email: string;
  owner_full_name: string;
  owner_package_code: string;
  owner_package_name: string;
  members: TeamMember[];
};

export type TeamMemberCandidate = {
  user_id: number;
  email: string;
  full_name: string;
  roles: string[];
  is_active: boolean;
  is_in_team: boolean;
};
