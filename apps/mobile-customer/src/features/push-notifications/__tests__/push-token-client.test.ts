import { registerPushToken, unregisterPushToken } from "../services/push-token-client";

describe("push-token-client", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  describe("registerPushToken", () => {
    test("posts to /store/push-tokens with the publishable key for scope=customer", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const ok = await registerPushToken("customer", "token", "ExponentPushToken[abc]", "ios");
      expect(ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/store/push-tokens"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "x-publishable-api-key": expect.any(String), Authorization: "Bearer token" }),
          body: JSON.stringify({ expo_push_token: "ExponentPushToken[abc]", platform: "ios" }),
        })
      );
    });

    test("posts to /seller/push-tokens without a publishable key for scope=seller", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });
      await registerPushToken("seller", "token", "ExponentPushToken[abc]", "android");
      const [url, options] = (globalThis.fetch as jest.Mock).mock.calls[0];
      expect(url).toContain("/seller/push-tokens");
      expect(options.headers["x-publishable-api-key"]).toBeUndefined();
    });

    test("resolves false instead of throwing when the request fails outright", async () => {
      (globalThis.fetch as jest.Mock).mockRejectedValue(new Error("network down"));
      const ok = await registerPushToken("customer", "token", "abc", "ios");
      expect(ok).toBe(false);
    });

    test("returns false when the response is not ok", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const ok = await registerPushToken("customer", "token", "abc", "ios");
      expect(ok).toBe(false);
    });
  });

  describe("unregisterPushToken", () => {
    test("DELETEs the token", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });
      const ok = await unregisterPushToken("customer", "token", "abc");
      expect(ok).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/store/push-tokens"),
        expect.objectContaining({ method: "DELETE", body: JSON.stringify({ expo_push_token: "abc" }) })
      );
    });
  });
});
