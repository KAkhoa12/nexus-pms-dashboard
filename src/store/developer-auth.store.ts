import { create } from "zustand";
import { developerApi } from "@/features/developer-portal/api/developer.api";
import {
  clearDeveloperAccessToken,
  getDeveloperAccessToken,
  setDeveloperAccessToken,
} from "@/features/developer-portal/auth/token";
import type { DeveloperAdmin } from "@/features/developer-portal/types";

type DeveloperAuthState = {
  admin: DeveloperAdmin | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isFetchingMe: boolean;
  login: (email: string, password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  logout: () => void;
};

const initialToken = getDeveloperAccessToken();

export const useDeveloperAuthStore = create<DeveloperAuthState>((set, get) => ({
  admin: null,
  accessToken: initialToken,
  isAuthenticated: Boolean(initialToken),
  isFetchingMe: false,

  async login(email, password) {
    const token = await developerApi.login({ email, password });
    setDeveloperAccessToken(token.access_token);
    set({
      accessToken: token.access_token,
      isAuthenticated: true,
    });
    await get().fetchMe();
  },

  async fetchMe() {
    if (!get().accessToken) {
      set({ isFetchingMe: false, isAuthenticated: false, admin: null });
      return;
    }

    set({ isFetchingMe: true });
    try {
      const profile = await developerApi.me();
      set({
        admin: profile,
        isFetchingMe: false,
        isAuthenticated: true,
      });
    } catch (error) {
      clearDeveloperAccessToken();
      set({
        admin: null,
        accessToken: null,
        isAuthenticated: false,
        isFetchingMe: false,
      });
      throw error;
    }
  },

  logout() {
    clearDeveloperAccessToken();
    set({
      admin: null,
      accessToken: null,
      isAuthenticated: false,
      isFetchingMe: false,
    });
    if (window.location.pathname !== "/dashboard-developer") {
      window.location.href = "/dashboard-developer";
    }
  },
}));
