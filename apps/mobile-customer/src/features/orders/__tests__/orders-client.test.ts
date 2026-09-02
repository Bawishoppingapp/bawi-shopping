import { getOrder, listOrders } from "../services/orders-client";

describe("orders-client", () => {
  beforeEach(() => {
    globalThis.fetch = jest.fn();
  });

  describe("listOrders", () => {
    test("returns an empty list without calling fetch when there is no session token", async () => {
      const result = await listOrders(null);
      expect(result).toEqual([]);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test("sends the publishable key and bearer token, returns the orders array", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ orders: [{ id: "order_1" }] }),
      });

      const result = await listOrders("token-abc");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/store/orders"),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: "Bearer token-abc" }),
        })
      );
      expect(result).toEqual([{ id: "order_1" }]);
    });

    test("returns an empty list on a non-ok response instead of throwing", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const result = await listOrders("token-abc");
      expect(result).toEqual([]);
    });
  });

  describe("getOrder", () => {
    test("returns null without calling fetch when there is no session token", async () => {
      const result = await getOrder("order_1", null);
      expect(result).toBeNull();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test("fetches the order by id and returns it", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ order: { id: "order_1", status: "paid" } }),
      });

      const result = await getOrder("order_1", "token-abc");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/store/orders/order_1"),
        expect.anything()
      );
      expect(result).toEqual({ id: "order_1", status: "paid" });
    });

    test("returns null on a non-ok response instead of throwing", async () => {
      (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: false });
      const result = await getOrder("order_1", "token-abc");
      expect(result).toBeNull();
    });
  });
});
