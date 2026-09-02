import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance } from "react-native";

export type AppAppearance = "light" | "dark";

const APPEARANCE_STORAGE_KEY = "bawi_appearance";

interface AppearanceContextValue {
  appearance: AppAppearance;
  setAppearance: (appearance: AppAppearance) => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function isAppAppearance(value: string | null): value is AppAppearance {
  return value === "light" || value === "dark";
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppAppearance>(
    Appearance.getColorScheme() === "dark" ? "dark" : "light",
  );
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const stored = await SecureStore.getItemAsync(APPEARANCE_STORAGE_KEY);
        if (!isMounted) return;
        const initialAppearance = isAppAppearance(stored)
          ? stored
          : Appearance.getColorScheme() === "dark"
            ? "dark"
            : "light";
        Appearance.setColorScheme(initialAppearance);
        setAppearanceState(initialAppearance);
      } catch {
        // A storage read failure should not prevent the app from opening;
        // the current device appearance remains the safe fallback.
      } finally {
        if (isMounted) setIsReady(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const setAppearance = useCallback((next: AppAppearance) => {
    Appearance.setColorScheme(next);
    setAppearanceState(next);
    void SecureStore.setItemAsync(APPEARANCE_STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ appearance, setAppearance }), [appearance, setAppearance]);

  if (!isReady) return null;

  // Known TS false positive for Context.Provider under this monorepo's
  // React type combination; this matches the app's other providers.
  // @ts-expect-error - see comment above
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext);
  if (!context) throw new Error("useAppearance must be used within an AppearanceProvider");
  return context;
}
