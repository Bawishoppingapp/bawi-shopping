import * as SecureStore from "expo-secure-store";

const ONBOARDING_COMPLETE_KEY = "bawi_onboarding_complete_v1";

export async function hasCompletedOnboarding(): Promise<boolean> {
  return (await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY)) === "true";
}

export async function completeOnboarding(): Promise<void> {
  await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, "true");
}

