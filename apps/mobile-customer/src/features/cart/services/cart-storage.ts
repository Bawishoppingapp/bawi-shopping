import * as SecureStore from "expo-secure-store";

const CART_ID_KEY = "bawi_cart_id";

/**
 * Native equivalent of the web storefront's `bawi_cart_id` cookie -
 * same 90-day intent, just stored in SecureStore instead of a cookie
 * jar (no cookies on a native client). The backend never sets this
 * itself; it's forwarded on every cart request as the x-cart-id header,
 * same as web (see cart-client.ts).
 */
export async function getCartId(): Promise<string | null> {
  return SecureStore.getItemAsync(CART_ID_KEY);
}

export async function setCartId(cartId: string): Promise<void> {
  await SecureStore.setItemAsync(CART_ID_KEY, cartId);
}

export async function clearCartId(): Promise<void> {
  await SecureStore.deleteItemAsync(CART_ID_KEY);
}
