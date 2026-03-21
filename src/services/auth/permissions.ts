export function hasPermission(permissions: string[], code: string): boolean {
  return (
    permissions.includes(code) ||
    permissions.includes("*") ||
    permissions.includes("all:*") ||
    permissions.includes("admin:*")
  );
}

export function hasAnyPermission(
  permissions: string[],
  codes: string[],
): boolean {
  return codes.some((code) => hasPermission(permissions, code));
}
