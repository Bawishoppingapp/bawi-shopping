import { useThemeColors } from "@bawi/mobile-ui";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import "@/global.css";
import { AppearanceProvider, useAppearance } from "@/features/appearance/hooks/use-appearance";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import { CartProvider } from "@/features/cart/hooks/use-cart";
import { CurrencyProvider } from "@/features/currency/hooks/use-currency";
import { LocaleProvider, useTranslations } from "@/features/i18n/hooks/use-locale";
import { PushNotificationRegistrar } from "@/features/push-notifications/components/push-notification-registrar";
import { SellerAuthProvider } from "@/features/seller-auth/hooks/use-seller-auth";
import { ToastProvider } from "@/features/toast/use-toast";

SplashScreen.preventAutoHideAsync();

function AppShell() {
  const themeColors = useThemeColors();
  const { appearance } = useAppearance();
  const t = useTranslations();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <SellerAuthProvider>
        <CartProvider>
          <PushNotificationRegistrar />
          <ToastProvider>
            <StatusBar style={appearance === "dark" ? "light" : "dark"} />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: themeColors.surface },
                headerTintColor: themeColors.ink950,
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="sell" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ presentation: "modal", title: t("login.submit") }} />
              <Stack.Screen name="register" options={{ presentation: "modal", title: t("register.submit") }} />
              <Stack.Screen name="forgot-password" options={{ title: t("auth.resetPassword") }} />
              <Stack.Screen name="reset-password" options={{ title: t("auth.resetPassword") }} />
            </Stack>
          </ToastProvider>
        </CartProvider>
      </SellerAuthProvider>
    </AuthProvider>
  );
}

// AppearanceProvider applies the saved preference before AppShell mounts,
// keeping the splash visible until the correct palette is ready.
export default function RootLayout() {
  return (
    <AppearanceProvider>
      <LocaleProvider>
        <CurrencyProvider>
          <AppShell />
        </CurrencyProvider>
      </LocaleProvider>
    </AppearanceProvider>
  );
}
