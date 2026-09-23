import * as SecureStore from "expo-secure-store";

import { completeOnboarding, hasCompletedOnboarding } from "../services/onboarding-storage";

describe("onboarding storage", () => {
  beforeEach(() => {
    (SecureStore as typeof SecureStore & { __reset: () => void }).__reset();
  });

  it("starts incomplete and persists completion", async () => {
    await expect(hasCompletedOnboarding()).resolves.toBe(false);

    await completeOnboarding();

    await expect(hasCompletedOnboarding()).resolves.toBe(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("bawi_onboarding_complete_v1", "true");
  });
});
