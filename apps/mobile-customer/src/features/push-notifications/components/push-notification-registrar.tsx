import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/features/auth/hooks/use-auth";
import { getSessionToken } from "@/features/auth/services/token-storage";
import { useSellerAuth } from "@/features/seller-auth/hooks/use-seller-auth";
import { getSellerSessionToken } from "@/features/seller-auth/services/seller-token-storage";

import { registerPushToken, unregisterPushToken } from "../services/push-token-client";
import { getExpoPushToken } from "../utils/get-expo-push-token";

const PLATFORM = Platform.OS === "android" ? "android" : "ios";

/**
 * No UI - mounted once near the root so both the customer and seller
 * sessions register/unregister this device's push token as each session
 * starts/ends. See get-expo-push-token.ts for why this is a real no-op
 * until a custom dev client with a real EAS project id exists; safe to
 * ship ahead of that since every step fails soft.
 */
export function PushNotificationRegistrar() {
  const { customer } = useAuth();
  const { seller } = useSellerAuth();
  const lastCustomerToken = useRef<string | null>(null);
  const lastCustomerPushToken = useRef<string | null>(null);
  const lastSellerToken = useRef<string | null>(null);
  const lastSellerPushToken = useRef<string | null>(null);

  useEffect(() => {
    if (!customer) {
      if (lastCustomerToken.current && lastCustomerPushToken.current) {
        void unregisterPushToken("customer", lastCustomerToken.current, lastCustomerPushToken.current);
      }
      lastCustomerToken.current = null;
      lastCustomerPushToken.current = null;
      return;
    }
    (async () => {
      const [sessionToken, expoPushToken] = await Promise.all([getSessionToken(), getExpoPushToken()]);
      if (!sessionToken || !expoPushToken) return;
      const ok = await registerPushToken("customer", sessionToken, expoPushToken, PLATFORM);
      if (ok) {
        lastCustomerToken.current = sessionToken;
        lastCustomerPushToken.current = expoPushToken;
      }
    })();
  }, [customer]);

  useEffect(() => {
    if (!seller) {
      if (lastSellerToken.current && lastSellerPushToken.current) {
        void unregisterPushToken("seller", lastSellerToken.current, lastSellerPushToken.current);
      }
      lastSellerToken.current = null;
      lastSellerPushToken.current = null;
      return;
    }
    (async () => {
      const [sessionToken, expoPushToken] = await Promise.all([getSellerSessionToken(), getExpoPushToken()]);
      if (!sessionToken || !expoPushToken) return;
      const ok = await registerPushToken("seller", sessionToken, expoPushToken, PLATFORM);
      if (ok) {
        lastSellerToken.current = sessionToken;
        lastSellerPushToken.current = expoPushToken;
      }
    })();
  }, [seller]);

  return null;
}
