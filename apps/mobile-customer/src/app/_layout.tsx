import { useThemeColors } from "@bawi/mobile-ui";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";

import "@/global.css";
import { AppearanceProvider, useAppearance } from "@/features/appearance/hooks/use-appearance";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import { CartProvider } from "@/features/cart/hooks/use-cart";
import { CurrencyProvider } from "@/features/currency/hooks/use-currency";
import { LocaleProvider, useTranslations } from "@/features/i18n/hooks/use-locale";
import { OnboardingScreen } from "@/features/onboarding/components/OnboardingScreen";
import { completeOnboarding, hasCompletedOnboarding } from "@/features/onboarding/services/onboarding-storage";
import { PushNotificationRegistrar } from "@/features/push-notifications/components/push-notification-registrar";
import { SellerAuthProvider } from "@/features/seller-auth/hooks/use-seller-auth";
import { ToastProvider } from "@/features/toast/use-toast";

SplashScreen.preventAutoHideAsync();

function AppShell() {
  const themeColors = useThemeColors();
  const { appearance } = useAppearance();
  const t = useTranslations();
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    hasCompletedOnboarding()
      .then((completed) => {
        if (mounted) setShowOnboarding(!completed);
      })
      .catch(() => {
        if (mounted) setShowOnboarding(true);
      })
      .finally(() => SplashScreen.hideAsync());
    return () => {
      mounted = false;
    };
  }, []);

  const finishOnboarding = useCallback(() => {
    setShowOnboarding(false);
    void completeOnboarding();
  }, []);

  if (showOnboarding === null) return null;

  if (showOnboarding) {
    return (
      <>
        <StatusBar style={appearance === "dark" ? "light" : "dark"} />
        <OnboardingScreen onComplete={finishOnboarding} />
      </>
    );
  }

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
                // Never expose internal route filenames (for example
                // "index" or "pitch") as iOS back-button labels.
                headerBackButtonDisplayMode: "minimal",
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
