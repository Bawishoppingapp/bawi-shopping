import { useThemeColors } from "@bawi/mobile-ui";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import "@/global.css";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import { CartProvider } from "@/features/cart/hooks/use-cart";
import { LocaleProvider } from "@/features/i18n/hooks/use-locale";
import { PushNotificationRegistrar } from "@/features/push-notifications/components/push-notification-registrar";
import { SellerAuthProvider } from "@/features/seller-auth/hooks/use-seller-auth";
import { ToastProvider } from "@/features/toast/use-toast";

SplashScreen.preventAutoHideAsync();

// Follows the system color scheme (see global.css's dark-mode media query) -
// native-stack's header chrome isn't a className/CSS-variable-driven
// element, so it needs its own explicit theme-aware screenOptions here,
// same reason ThemedIcon/useThemeColors exist for other non-className props.
export default function RootLayout() {
  const themeColors = useThemeColors();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <LocaleProvider>
      <AuthProvider>
        <SellerAuthProvider>
          <CartProvider>
            <PushNotificationRegistrar />
            <ToastProvider>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: themeColors.surface },
                  headerTintColor: themeColors.ink950,
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="login"
                  options={{ presentation: "modal", title: "Log in" }}
                />
                <Stack.Screen
                  name="register"
                  options={{ presentation: "modal", title: "Create account" }}
                />
              </Stack>
            </ToastProvider>
          </CartProvider>
        </SellerAuthProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
