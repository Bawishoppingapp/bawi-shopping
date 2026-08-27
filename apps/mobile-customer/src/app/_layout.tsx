import { StripeProvider } from "@stripe/stripe-react-native";
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

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

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
            {/* No merchantIdentifier set - Apple Pay stays disabled until a
                real Apple merchant id is registered and added here; card
                payment via the Payment Sheet works without it. */}
            <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY} urlScheme="mobilecustomer">
              <PushNotificationRegistrar />
              <ToastProvider>
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
              </ToastProvider>
            </StripeProvider>
          </CartProvider>
        </SellerAuthProvider>
      </AuthProvider>
    </LocaleProvider>
  );
}
