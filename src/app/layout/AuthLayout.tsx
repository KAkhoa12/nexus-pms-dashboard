import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-muted/20">
      <Outlet />
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <div className="rounded-lg border bg-card p-8 text-center">
        <h1 className="text-2xl font-semibold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Trang bạn truy cập không tồn tại hoặc không được phép truy cập.
        </p>
      </div>
    </div>
  );
}
