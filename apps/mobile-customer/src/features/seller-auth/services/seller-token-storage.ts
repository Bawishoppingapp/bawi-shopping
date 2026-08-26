import * as SecureStore from "expo-secure-store";

const SELLER_SESSION_TOKEN_KEY = "bawi_seller_session";

/**
 * Native equivalent of the web seller portal's httpOnly `bawi_seller_session`
 * cookie. Kept separate from the customer session's SecureStore key so a
 * single device can hold both a customer and a seller session at once.
 */
export async function getSellerSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SELLER_SESSION_TOKEN_KEY);
}

export async function setSellerSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SELLER_SESSION_TOKEN_KEY, token);
}

export async function clearSellerSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SELLER_SESSION_TOKEN_KEY);
}
