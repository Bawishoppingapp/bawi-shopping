import { DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import "@/global.css";
import { AuthProvider } from "@/features/auth/hooks/use-auth";

SplashScreen.preventAutoHideAsync();

// v1 is deliberately light-mode only (matches the web app's own
// documented decision, docs/DESIGN-SYSTEM.md #2) - always DefaultTheme,
// not system-color-scheme-driven, so nav chrome never disagrees with the
// light-only Bawi content screens.
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={DefaultTheme}>
      <AuthProvider>
        <Stack>
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
      </AuthProvider>
    </ThemeProvider>
  );
}
