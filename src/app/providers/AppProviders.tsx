import { useEffect } from "react";
import type { PropsWithChildren } from "react";
import { setupHttpInterceptors } from "@/services/http/interceptors";
import { storage } from "@/services/storage";
import { getRefreshToken } from "@/services/auth/token";
import { Toaster } from "@/components/ui/sonner";
import { useAuthStore } from "@/store/auth.store";
import { useThemeStore } from "@/store/ui.store";

export function AppProviders({ children }: PropsWithChildren) {
  const initializeTheme = useThemeStore((state) => state.initialize);
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const accessToken = useAuthStore((state) => state.accessToken);
  const subscription = useAuthStore((state) => state.subscription);
  const preferences = useAuthStore((state) => state.preferences);
  const fetchMe = useAuthStore((state) => state.fetchMe);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    setupHttpInterceptors();
    initializeTheme();
  }, [initializeTheme]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (accessToken) {
        void fetchMe().catch(() => undefined);
        return;
      }
      if (getRefreshToken()) {
        void restoreSession().catch(() => undefined);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [accessToken, fetchMe, restoreSession]);

  useEffect(() => {
    if (!accessToken || !preferences) return;
    const preferredTheme = preferences.themeMode;
    if (
      preferredTheme === "light" ||
      preferredTheme === "dark" ||
      preferredTheme === "sunset" ||
      preferredTheme === "aurora"
    ) {
      if (preferredTheme !== mode) {
        setMode(preferredTheme);
      }
    }
    if (preferences.workspaceKey) {
      storage.set("active_workspace_key", preferences.workspaceKey);
    }
  }, [accessToken, preferences?.themeMode, preferences?.workspaceKey, setMode]);

  useEffect(() => {
    const canUseSunset = subscription?.canUseSunsetTheme ?? false;
    const canUseAurora = Boolean(
      subscription?.featureCodes.includes("PRO_AURORA_THEME"),
    );
    if (mode === "sunset" && !canUseSunset) {
      setMode("light");
      return;
    }
    if (mode === "aurora" && !canUseAurora) {
      setMode("light");
    }
  }, [
    mode,
    setMode,
    subscription?.canUseSunsetTheme,
    subscription?.featureCodes,
  ]);

  return (
    <>
      {children}
      <Toaster position="top-right" richColors />
    </>
  );
}
