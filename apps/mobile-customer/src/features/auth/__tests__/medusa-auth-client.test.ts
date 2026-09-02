import {
  MedusaAuthError,
  createCustomer,
  deleteCustomerAccount,
  getCurrentCustomer,
  loginCustomer,
  registerCustomerAuthIdentity,
  requestPasswordReset,
  resetPassword,
} from "../services/medusa-auth-client";

describe("medusa-auth-client", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  describe("registerCustomerAuthIdentity", () => {
    test("returns the registration token on success", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ token: "reg-token" })),
      });
      const token = await registerCustomerAuthIdentity("a@b.com", "pw");
      expect(token).toBe("reg-token");
    });

    test("throws MedusaAuthError with the server message on failure", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ message: "Email already exists" })),
      });
      await expect(registerCustomerAuthIdentity("a@b.com", "pw")).rejects.toThrow(MedusaAuthError);
      await expect(registerCustomerAuthIdentity("a@b.com", "pw")).rejects.toThrow("Email already exists");
    });

    test("falls back to a default message when the body isn't valid JSON", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, text: () => Promise.resolve("") });
      await expect(registerCustomerAuthIdentity("a@b.com", "pw")).rejects.toThrow("Could not create account");
    });
  });

  describe("createCustomer", () => {
    test("sends the registration bearer token and publishable key", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ customer: { id: "cus_1" } })),
      });
      const customer = await createCustomer("reg-token", { email: "a@b.com", first_name: "A", last_name: "B" });
      expect(customer).toEqual({ id: "cus_1" });
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/store/customers"),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer reg-token" }),
        })
      );
    });
  });

  describe("loginCustomer", () => {
    test("returns the session token on success", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ token: "session-token" })),
      });
      const token = await loginCustomer("a@b.com", "pw");
      expect(token).toBe("session-token");
    });

    test("throws with an invalid-credentials message on failure", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, text: () => Promise.resolve("{}") });
      await expect(loginCustomer("a@b.com", "wrong")).rejects.toThrow("Invalid email or password");
    });
  });

  describe("requestPasswordReset", () => {
    test("always resolves, even on a non-ok response (avoids leaking which emails exist)", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
    });
  });

  describe("resetPassword", () => {
    test("throws with the server message when the code is invalid", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ message: "Invalid or expired token" })),
      });
      await expect(resetPassword("bad-token", "NewPass123")).rejects.toThrow("Invalid or expired token");
    });
  });

  describe("getCurrentCustomer", () => {
    test("returns the customer on success", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ customer: { id: "cus_1" } })),
      });
      const customer = await getCurrentCustomer("token");
      expect(customer).toEqual({ id: "cus_1" });
    });

    test("returns null on a non-ok response (e.g. an expired token) instead of throwing", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const customer = await getCurrentCustomer("stale-token");
      expect(customer).toBeNull();
    });
  });

  describe("deleteCustomerAccount", () => {
    test("deletes the authenticated customer with the session and publishable key", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });

      await deleteCustomerAccount("session-token");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/store/customers/me"),
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
        })
      );
    });

    test("surfaces the backend error without clearing the local session", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ message: "Account could not be deleted" })),
      });

      await expect(deleteCustomerAccount("session-token")).rejects.toThrow("Account could not be deleted");
    });
  });
});
