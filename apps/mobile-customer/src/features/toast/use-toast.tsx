import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Animated, Pressable, Text } from "react-native";

interface ToastOptions {
  actionLabel?: string;
  onPress?: () => void;
}

interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 2600;

/**
 * A single, app-wide toast (not a queue) - a second show() while one is
 * already visible just replaces it, since a shopper acting fast enough to
 * trigger two of these only cares about the most recent one. Mounted once
 * near the root so it works regardless of which screen/tab triggers it -
 * see CLAUDE.md's mobile section, this is the fix for "no feedback after
 * adding to bag unless you go check the cart yourself."
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; options?: ToastOptions } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, options?: ToastOptions) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast({ message, options });
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      hideTimer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
          setToast(null);
        });
      }, VISIBLE_MS);
    },
    [opacity]
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    // @ts-expect-error - see the identical comment on AuthProvider's return
    // in features/auth/hooks/use-auth.tsx.
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView message={toast.message} options={toast.options} opacity={opacity} /> : null}
    </ToastContext.Provider>
  );
}

function ToastView({
  message,
  options,
  opacity,
}: {
  message: string;
  options?: ToastOptions;
  opacity: Animated.Value;
}) {
  // Bottom tabs aren't mounted above every screen this can fire from
  // (e.g. product detail is pushed outside the tab navigator), so this
  // falls back to a safe fixed offset when the hook has nothing to
  // report rather than crashing.
  let tabBarHeight = 0;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- try/catch around a hook call is intentional here: useBottomTabBarHeight throws outside a bottom-tab navigator context, and this component can be rendered from screens both inside and outside the tab navigator.
    tabBarHeight = useBottomTabBarHeight();
  } catch {
    tabBarHeight = 0;
  }

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 16, right: 16, bottom: tabBarHeight + 16, opacity }}
    >
      <Pressable
        accessibilityRole={options?.onPress ? "button" : "text"}
        onPress={options?.onPress}
        className="flex-row items-center justify-between gap-3 rounded-lg bg-ink-950 px-4 py-3.5"
      >
        <Text className="flex-1 text-body-sm text-white">{message}</Text>
        {options?.actionLabel ? (
          <Text className="text-body-sm font-medium text-gold-500">{options.actionLabel}</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
