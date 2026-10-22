import {
  CustomerServiceUnavailableError,
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

    test("stops loading when the backend does not respond", async () => {
      jest.useFakeTimers();
      try {
        (globalThis.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
        const login = loginCustomer("a@b.com", "pw");
        const result = expect(login).rejects.toThrow(CustomerServiceUnavailableError);
        await jest.advanceTimersByTimeAsync(30_000);
        await result;
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe("requestPasswordReset", () => {
    test("resolves when the backend accepts the privacy-preserving request", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });
      await expect(requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
    });

    test("surfaces backend delivery failures without exposing account existence", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      await expect(requestPasswordReset("nobody@example.com")).rejects.toThrow(
        "Could not request a password reset"
      );
    });
  });

  describe("resetPassword", () => {
    test("throws with the server message when the code is invalid", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(JSON.stringify({ message: "Invalid or expired token" })),
      });
      await expect(resetPassword("a@b.com", "bad-token", "NewPass123")).rejects.toThrow("Invalid or expired token");
    });

    test("sends the customer email with the new password", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, text: () => Promise.resolve("{}") });

      await resetPassword("a@b.com", "reset-token", "NewPass123");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/customer/emailpass/update"),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer reset-token" }),
          body: JSON.stringify({ email: "a@b.com", password: "NewPass123" }),
        })
      );
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

    test("treats a server outage as retriable rather than an expired session", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503, text: () => Promise.resolve("{}") });
      await expect(getCurrentCustomer("valid-token")).rejects.toThrow(CustomerServiceUnavailableError);
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
