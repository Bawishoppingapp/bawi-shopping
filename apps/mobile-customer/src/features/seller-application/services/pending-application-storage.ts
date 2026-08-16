import * as SecureStore from "expo-secure-store";

const PENDING_APPLICATION_ID_KEY = "bawi_pending_seller_application_id";

/**
 * The web application flow keeps its application id in the URL
 * (/apply/[id]); a mobile app has no URL to persist that in, so this is the
 * native equivalent - lets the Sell tab resume showing status after an app
 * restart, before any seller session exists yet.
 */
export async function getPendingApplicationId(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_APPLICATION_ID_KEY);
}

export async function setPendingApplicationId(id: string): Promise<void> {
  await SecureStore.setItemAsync(PENDING_APPLICATION_ID_KEY, id);
}

export async function clearPendingApplicationId(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_APPLICATION_ID_KEY);
}
