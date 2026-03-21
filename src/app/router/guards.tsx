import type { PropsWithChildren } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth.store";
import { hasAnyPermission } from "@/services/auth/permissions";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate to="/dashboard/login" replace state={{ from: location }} />
    );
  }

  return <>{children}</>;
}

type PermissionGuardProps = PropsWithChildren<{
  permissions: string[];
}>;

export function PermissionGuard({
  children,
  permissions,
}: PermissionGuardProps) {
  const userPermissions = useAuthStore((state) => state.permissions);
  const isFetchingMe = useAuthStore((state) => state.isFetchingMe);

  if (isFetchingMe) {
    return null;
  }

  const canAccess = hasAnyPermission(userPermissions, permissions);

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

type PackageGuardProps = PropsWithChildren<{
  packageCodes: string[];
}>;

export function PackageGuard({ children, packageCodes }: PackageGuardProps) {
  const subscription = useAuthStore((state) => state.subscription);
  const isFetchingMe = useAuthStore((state) => state.isFetchingMe);

  if (isFetchingMe) {
    return null;
  }

  const currentPackageCode = subscription?.packageCode || "FREE";
  if (!packageCodes.includes(currentPackageCode)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
