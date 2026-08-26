import { StripeOnboardingError, createOnboardingLink } from "../services/stripe-onboarding-client";

describe("stripe-onboarding-client", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("returns the onboarding url on success", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://connect.stripe.com/setup/abc" }),
    });
    const url = await createOnboardingLink("token");
    expect(url).toBe("https://connect.stripe.com/setup/abc");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/seller/stripe/onboarding-link"),
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer token" } })
    );
  });

  test("throws StripeOnboardingError on failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    await expect(createOnboardingLink("token")).rejects.toThrow(StripeOnboardingError);
  });
});
