import { useThemeStore } from "@/store/ui.store";

export function useThemeMode() {
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  const toggleMode = useThemeStore((state) => state.toggleMode);

  return { mode, setMode, toggleMode, isDark: mode === "dark" };
}
