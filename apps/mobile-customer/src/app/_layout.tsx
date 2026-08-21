import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

import "@/global.css";
import { AuthProvider } from "@/features/auth/hooks/use-auth";
import { CartProvider } from "@/features/cart/hooks/use-cart";
import { LocaleProvider } from "@/features/i18n/hooks/use-locale";
import { SellerAuthProvider } from "@/features/seller-auth/hooks/use-seller-auth";

SplashScreen.preventAutoHideAsync();

// v1 is deliberately light-mode only (matches the web app's own
// documented decision, docs/DESIGN-SYSTEM.md #2) - React Navigation's
// native-stack defaults to a light theme already, so no explicit theme
// wiring is needed.
export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <LocaleProvider>
      <AuthProvider>
        <SellerAuthProvider>
          <CartProvider>
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
          </CartProvider>
        </SellerAuthProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
