export type PermissionEffect = "ALLOW" | "DENY";

export type UserPermissionOverride = {
  id: number;
  user_id: number;
  permission_code: string;
  effect: PermissionEffect;
};

export type DeleteUserPermissionResult = {
  removed: boolean;
};
