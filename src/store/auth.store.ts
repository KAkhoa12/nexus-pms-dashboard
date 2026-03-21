import { create } from "zustand";
import { authApi } from "@/features/auth/api/auth.api";
import type {
  SubscriptionAccess,
  User,
  UserPreferences,
} from "@/features/auth/types";
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  setAuthTokens,
} from "@/services/auth/token";
import { hasPermission as hasPermissionUtil } from "@/services/auth/permissions";

type AuthState = {
  user: User | null;
  permissions: string[];
  subscription: SubscriptionAccess | null;
  preferences: UserPreferences | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isFetchingMe: boolean;
  setPreferences: (preferences: Partial<UserPreferences>) => void;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  restoreSession: () => Promise<void>;
  logout: () => void;
  hasPermission: (code: string) => boolean;
};

const initialAccessToken = getAccessToken();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  permissions: [],
  subscription: null,
  preferences: null,
  accessToken: initialAccessToken,
  isAuthenticated: Boolean(initialAccessToken),
  isFetchingMe: Boolean(initialAccessToken),

  setPreferences(preferences) {
    set((state) => ({
      preferences: {
        themeMode: state.preferences?.themeMode ?? null,
        workspaceKey: state.preferences?.workspaceKey ?? null,
        ...preferences,
      },
    }));
  },

  async login(email, password) {
    const result = await authApi.login({ email, password });
    setAuthTokens({
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      accessTokenExpiresIn: result.expires_in,
      refreshTokenExpiresIn: result.refresh_expires_in,
    });
    set({ accessToken: result.access_token, isAuthenticated: true });
    await get().fetchMe();
  },

  async loginWithGoogle(credential) {
    const result = await authApi.loginWithGoogle({ credential });
    setAuthTokens({
      accessToken: result.access_token,
      refreshToken: result.refresh_token,
      accessTokenExpiresIn: result.expires_in,
      refreshTokenExpiresIn: result.refresh_expires_in,
    });
    set({ accessToken: result.access_token, isAuthenticated: true });
    await get().fetchMe();
  },

  async fetchMe() {
    set({ isFetchingMe: true });
    try {
      const me = await authApi.me();
      set({
        user: me.user,
        permissions: me.permissions,
        subscription: me.subscription,
        preferences: me.preferences,
        isAuthenticated: true,
        isFetchingMe: false,
      });
    } catch (error) {
      set({ isFetchingMe: false });
      throw error;
    }
  },

  async restoreSession() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      set({
        user: null,
        permissions: [],
        subscription: null,
        preferences: null,
        accessToken: null,
        isAuthenticated: false,
        isFetchingMe: false,
      });
      return;
    }

    set({ isFetchingMe: true });
    try {
      const result = await authApi.refresh(refreshToken);
      setAuthTokens({
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        accessTokenExpiresIn: result.expires_in,
        refreshTokenExpiresIn: result.refresh_expires_in,
      });
      set({
        accessToken: result.access_token,
        isAuthenticated: true,
        isFetchingMe: false,
      });
    } catch (error) {
      clearAuthTokens();
      set({
        user: null,
        permissions: [],
        subscription: null,
        preferences: null,
        accessToken: null,
        isAuthenticated: false,
        isFetchingMe: false,
      });
      throw error;
    }
  },

  logout() {
    clearAuthTokens();
    set({
      user: null,
      permissions: [],
      subscription: null,
      preferences: null,
      accessToken: null,
      isAuthenticated: false,
      isFetchingMe: false,
    });
    const redirectPath = window.location.pathname.startsWith(
      "/dashboard-developer",
    )
      ? "/dashboard-developer"
      : "/dashboard/login";
    if (window.location.pathname !== redirectPath) {
      window.location.href = redirectPath;
    }
  },

  hasPermission(code) {
    return hasPermissionUtil(get().permissions, code);
  },
}));
