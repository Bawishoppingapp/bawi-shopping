import {
  SellerAuthError,
  completeSellerActivation,
  getCurrentSeller,
  loginSellerUser,
} from "../services/seller-medusa-auth-client";

describe("seller-medusa-auth-client", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  describe("loginSellerUser", () => {
    test("hits the seller_user emailpass endpoint and returns the token", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ token: "seller-token" })),
      });
      const token = await loginSellerUser("owner@shop.com", "pw");
      expect(token).toBe("seller-token");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/seller_user/emailpass"),
        expect.anything()
      );
    });

    test("throws SellerAuthError on invalid credentials", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, text: () => Promise.resolve("{}") });
      await expect(loginSellerUser("owner@shop.com", "wrong")).rejects.toThrow(SellerAuthError);
    });
  });

  describe("completeSellerActivation", () => {
    test("posts the token and new password", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, text: () => Promise.resolve("{}") });
      await completeSellerActivation("activation-token", "NewPass123");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/seller-activation/complete"),
        expect.objectContaining({
          body: JSON.stringify({ token: "activation-token", password: "NewPass123" }),
        })
      );
    });

    test("throws with the server message on failure", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ message: "Token expired" })),
      });
      await expect(completeSellerActivation("bad", "pw")).rejects.toThrow("Token expired");
    });
  });

  describe("getCurrentSeller", () => {
    test("returns the seller session on success, including Stripe status", async () => {
      const sellerMe = {
        seller_user: { id: "su_1", role: "owner" },
        seller: {
          id: "s_1",
          name: "Acme",
          slug: "acme",
          status: "approved",
          currency_code: "etb",
          stripe: { connected: false, charges_enabled: false, payouts_enabled: false, details_submitted: false },
        },
      };
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(sellerMe)),
      });
      const result = await getCurrentSeller("token");
      expect(result).toEqual(sellerMe);
    });

    test("returns null on a non-ok response instead of throwing", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const result = await getCurrentSeller("stale-token");
      expect(result).toBeNull();
    });
  });
});
