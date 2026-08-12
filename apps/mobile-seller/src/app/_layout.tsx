import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import "@/global.css";
import { AuthProvider } from "@/features/auth/hooks/use-auth";

SplashScreen.preventAutoHideAsync();

// v1 is deliberately light-mode only, same decision as mobile-customer
// (docs/DESIGN-SYSTEM.md #2) - React Navigation's native-stack defaults to
// a light theme already, so no explicit theme wiring is needed.
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}
