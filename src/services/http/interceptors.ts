import axios from "axios";
import { httpClient } from "@/services/http/client";
import {
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/services/auth/token";
import { storage } from "@/services/storage";
import { useAuthStore } from "@/store/auth.store";
import type { ApiEnvelope, LoginResponse } from "@/features/auth/types";

let initialized = false;
let refreshPromise: Promise<string> | null = null;

type RetryableRequestConfig = {
  _retry?: boolean;
  _skipAuthRefresh?: boolean;
  url?: string;
  headers?: Record<string, string>;
};

function isAuthLoginRequest(url?: string): boolean {
  return (url || "").includes("/auth/login");
}

function isAuthRefreshRequest(url?: string): boolean {
  return (url || "").includes("/auth/refresh");
}

function shouldSkipRefresh(config?: RetryableRequestConfig): boolean {
  if (!config) return false;
  if (config._skipAuthRefresh) return true;
  if (isAuthLoginRequest(config.url)) return true;
  return false;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("Không tìm thấy refresh token.");
  }

  const { data } = await axios.post<ApiEnvelope<LoginResponse>>(
    "/auth/refresh",
    { refresh_token: refreshToken },
    {
      baseURL: import.meta.env.VITE_API_BASE_URL,
      timeout: 15000,
    },
  );

  if (!data.response) {
    throw new Error(data.message || "Làm mới token thất bại.");
  }

  setAuthTokens({
    accessToken: data.response.access_token,
    refreshToken: data.response.refresh_token,
    accessTokenExpiresIn: data.response.expires_in,
    refreshTokenExpiresIn: data.response.refresh_expires_in,
  });
  useAuthStore.setState({
    accessToken: data.response.access_token,
    isAuthenticated: true,
  });

  return data.response.access_token;
}

export function setupHttpInterceptors(): void {
  if (initialized) return;

  httpClient.interceptors.request.use(async (config) => {
    let token = getAccessToken();
    const isRefreshRequest = isAuthRefreshRequest(config.url);

    if (!token && !isRefreshRequest && getRefreshToken()) {
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      try {
        token = await refreshPromise;
      } catch {
        token = null;
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const workspaceKey = storage.get("active_workspace_key");
    if (workspaceKey) {
      config.headers["X-Workspace-Key"] = workspaceKey;
    }
    return config;
  });

  httpClient.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      if (!axios.isAxiosError(error)) {
        return Promise.reject(error);
      }

      const statusCode = error.response?.status;
      const originalConfig = (error.config || {}) as RetryableRequestConfig;

      if (statusCode !== 401) {
        return Promise.reject(error);
      }

      if (isAuthRefreshRequest(originalConfig.url)) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      if (shouldSkipRefresh(originalConfig) || originalConfig._retry) {
        return Promise.reject(error);
      }

      if (!getRefreshToken()) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      originalConfig._retry = true;

      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      return refreshPromise
        .then((newAccessToken) => {
          const nextHeaders = {
            ...(originalConfig.headers || {}),
            Authorization: `Bearer ${newAccessToken}`,
          };
          return httpClient({
            ...(error.config || {}),
            headers: nextHeaders,
          });
        })
        .catch((refreshError) => {
          useAuthStore.getState().logout();
          return Promise.reject(refreshError);
        });
    },
  );

  initialized = true;
}
