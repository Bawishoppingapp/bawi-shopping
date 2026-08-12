import * as SecureStore from "expo-secure-store";

const SESSION_TOKEN_KEY = "bawi_seller_session";

/**
 * Native equivalent of the web seller portal's httpOnly `bawi_seller_session`
 * cookie. expo-secure-store is Keychain-backed on iOS / Keystore-backed on
 * Android - encrypted at rest, not readable by other apps.
 */
export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}
