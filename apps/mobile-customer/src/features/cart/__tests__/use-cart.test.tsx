import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";

import { useAuth } from "@/features/auth/hooks/use-auth";

import { CartProvider, useCart } from "../hooks/use-cart";
import * as cartClient from "../services/cart-client";

jest.mock("../services/cart-client");
jest.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: jest.fn(() => ({ customer: null })),
}));

const mockedClient = cartClient as jest.Mocked<typeof cartClient>;
const mockedUseAuth = useAuth as jest.Mock;

function wrapper({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}

const emptyCart = {
  id: "cart_1",
  currency_code: "usd",
  items: [],
  item_count: 0,
  subtotal: 0,
  shipping_estimate: 0,
  free_shipping_threshold: 0,
  amount_remaining_for_free_shipping: 0,
  qualifies_for_free_shipping: false,
  checkout_blocked: false,
  warnings: [],
};

describe("useCart", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore as unknown as { __reset: () => void }).__reset();
    mockedUseAuth.mockReturnValue({ customer: null });
  });

  test("starts with no cart when nothing is stored, and stops loading", async () => {
    const { result } = await renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.cart).toBeNull();
    expect(mockedClient.getCart).not.toHaveBeenCalled();
  });

  test("addItem stores the returned cart id and updates cart state", async () => {
    mockedClient.addCartItem.mockResolvedValue({ ...emptyCart, item_count: 1 });

    const { result } = await renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addItem("variant_1", 1);
    });

    expect(result.current.cart?.item_count).toBe(1);
    expect(mockedClient.addCartItem).toHaveBeenCalledWith(null, "variant_1", 1, null);
  });

  test("updateQuantity is a no-op when there is no cart id yet", async () => {
    const { result } = await renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateQuantity("item_1", 2);
    });

    expect(mockedClient.updateCartItemQuantity).not.toHaveBeenCalled();
  });

  test("removeItem is a no-op when there is no cart id yet", async () => {
    const { result } = await renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.removeItem("item_1");
    });

    expect(mockedClient.removeCartItem).not.toHaveBeenCalled();
  });

  test("updateQuantity calls through once a cart exists", async () => {
    mockedClient.addCartItem.mockResolvedValue({ ...emptyCart, item_count: 1 });
    mockedClient.updateCartItemQuantity.mockResolvedValue({ ...emptyCart, item_count: 2 });

    const { result } = await renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.addItem("variant_1", 1);
    });

    await act(async () => {
      await result.current.updateQuantity("item_1", 2);
    });

    expect(mockedClient.updateCartItemQuantity).toHaveBeenCalledWith("cart_1", "item_1", 2, null);
    expect(result.current.cart?.item_count).toBe(2);
  });

  test("merges the guest cart into the customer cart once a customer appears", async () => {
    await SecureStore.setItemAsync("bawi_cart_id", "guest_cart_1");
    await SecureStore.setItemAsync("bawi_customer_session", "session-token");
    mockedClient.getCart.mockResolvedValue({ ...emptyCart, id: "guest_cart_1" });
    mockedClient.mergeGuestCartIntoCustomerCart.mockResolvedValue(undefined);

    mockedUseAuth.mockReturnValue({ customer: null });
    const { result, rerender } = await renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockedUseAuth.mockReturnValue({ customer: { id: "cus_1" } });
    await act(async () => {
      rerender({});
    });

    await waitFor(() =>
      expect(mockedClient.mergeGuestCartIntoCustomerCart).toHaveBeenCalledWith("guest_cart_1", "session-token")
    );
    // The guest cart id is cleared locally after a successful merge - the
    // customer's own cart is the source of truth from here on.
    await waitFor(async () => expect(await SecureStore.getItemAsync("bawi_cart_id")).toBeNull());
  });

  test("a failed guest-cart merge is best-effort and keeps the guest cart id for a later retry", async () => {
    await SecureStore.setItemAsync("bawi_cart_id", "guest_cart_1");
    await SecureStore.setItemAsync("bawi_customer_session", "session-token");
    mockedClient.getCart.mockResolvedValue({ ...emptyCart, id: "guest_cart_1" });
    mockedClient.mergeGuestCartIntoCustomerCart.mockRejectedValue(new Error("network down"));

    mockedUseAuth.mockReturnValue({ customer: null });
    const { rerender } = await renderHook(() => useCart(), { wrapper });

    mockedUseAuth.mockReturnValue({ customer: { id: "cus_1" } });
    await act(async () => {
      rerender({});
    });

    await waitFor(() => expect(mockedClient.mergeGuestCartIntoCustomerCart).toHaveBeenCalled());
    expect(await SecureStore.getItemAsync("bawi_cart_id")).toBe("guest_cart_1");
  });

  test("a transient refresh error leaves the last-known cart in place", async () => {
    mockedClient.addCartItem.mockResolvedValue({ ...emptyCart, item_count: 1 });

    const { result } = await renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.addItem("variant_1", 1);
    });
    expect(result.current.cart?.item_count).toBe(1);

    mockedClient.getCart.mockRejectedValue(new Error("network down"));
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.cart?.item_count).toBe(1);
  });
});
