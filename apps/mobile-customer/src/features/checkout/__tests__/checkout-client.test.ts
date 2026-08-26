import { CheckoutError, startCheckout } from "../services/checkout-client";

const validAddress = {
  first_name: "Selam",
  last_name: "Tesfaye",
  address_1: "Bole Road",
  city: "Addis Ababa",
  country_code: "et",
  phone: "+251911234567",
};

describe("checkout-client", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  test("throws CheckoutError without calling fetch when there is no session token", async () => {
    await expect(startCheckout(null, validAddress, "idem-1")).rejects.toThrow(CheckoutError);
    await expect(startCheckout(null, validAddress, "idem-1")).rejects.toThrow("You must be signed in");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("posts the shipping address and idempotency key, returns the checkout result", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({ order_id: "order_1", display_id: "1001", status: "pending_payment", client_secret: "pi_secret" })
        ),
    });

    const result = await startCheckout("token", validAddress, "idem-1");

    expect(result).toEqual({ order_id: "order_1", display_id: "1001", status: "pending_payment", client_secret: "pi_secret" });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/store/checkout"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
        body: JSON.stringify({ shipping_address: validAddress, idempotency_key: "idem-1" }),
      })
    );
  });

  test("throws CheckoutError with the server message on a validation failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      text: () => Promise.resolve(JSON.stringify({ message: "Postal code is required for this country" })),
    });
    await expect(startCheckout("token", validAddress, "idem-1")).rejects.toThrow(
      "Postal code is required for this country"
    );
  });

  test("reusing the same idempotency key sends the same key again (retry semantics)", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ order_id: "order_1", display_id: "1001", status: "paid", client_secret: null })),
    });

    await startCheckout("token", validAddress, "idem-shared");
    await startCheckout("token", validAddress, "idem-shared");

    const bodies = (global.fetch as jest.Mock).mock.calls.map(([, opts]) => JSON.parse(opts.body).idempotency_key);
    expect(bodies).toEqual(["idem-shared", "idem-shared"]);
  });
});
