import { useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GoogleLoginButton } from "@/features/auth/components/GoogleLoginButton";
import { useAuthStore } from "@/store/auth.store";

type ApiErrorItem = {
  msg?: string;
};

type ApiErrorBody = {
  message?: string;
  response?: ApiErrorItem[];
};

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Email và mật khẩu là bắt buộc.");
      return;
    }

    if (!isEmail(email)) {
      setError("Email không đúng định dạng.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = axios.isAxiosError<ApiErrorBody>(err)
        ? (err.response?.data?.message ??
          err.response?.data?.response?.[0]?.msg ??
          err.message ??
          "Đăng nhập thất bại.")
        : err instanceof Error
          ? err.message
          : "Đăng nhập thất bại.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin(credential: string) {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = axios.isAxiosError<ApiErrorBody>(err)
        ? (err.response?.data?.message ??
          err.response?.data?.response?.[0]?.msg ??
          err.message ??
          "Đăng nhập Google thất bại.")
        : err instanceof Error
          ? err.message
          : "Đăng nhập Google thất bại.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Đăng nhập</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </Button>
          </form>
          <div className="my-4">
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                hoặc
              </p>
              <Separator className="flex-1" />
            </div>
          </div>
          <div className="flex justify-center">
            <GoogleLoginButton
              disabled={loading}
              onCredential={(credential) => {
                void handleGoogleLogin(credential);
              }}
              onError={(message) => setError(message)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
