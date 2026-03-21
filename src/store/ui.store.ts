import { create } from "zustand";
import { storage } from "@/services/storage";

export type ThemeMode = "light" | "dark" | "sunset" | "aurora";

type UiState = {
  mode: ThemeMode;
  initialize: () => void;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const THEME_KEY = "theme_mode";

function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.remove("dark", "sunset", "aurora");
  if (mode !== "light") {
    root.classList.add(mode);
  }
}

export const useThemeStore = create<UiState>((set, get) => ({
  mode: "light",
  initialize() {
    const saved = storage.get(THEME_KEY);
    const mode: ThemeMode =
      saved === "dark" || saved === "sunset" || saved === "aurora"
        ? saved
        : "light";
    applyTheme(mode);
    set({ mode });
  },
  setMode(mode) {
    applyTheme(mode);
    storage.set(THEME_KEY, mode);
    set({ mode });
  },
  toggleMode() {
    const next =
      get().mode === "light"
        ? "dark"
        : get().mode === "dark"
          ? "sunset"
          : get().mode === "sunset"
            ? "aurora"
            : "light";
    get().setMode(next);
  },
}));
