import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";

import { SellerAuthProvider, useSellerAuth } from "../hooks/use-seller-auth";
import * as sellerAuthClient from "../services/seller-medusa-auth-client";

jest.mock("../services/seller-medusa-auth-client");

const mockedClient = sellerAuthClient as jest.Mocked<typeof sellerAuthClient>;

function wrapper({ children }: { children: ReactNode }) {
  return <SellerAuthProvider>{children}</SellerAuthProvider>;
}

const sellerMe = {
  seller_user: { id: "su_1", role: "owner" },
  seller: {
    id: "s_1",
    name: "Acme",
    slug: "acme",
    status: "approved",
    currency_code: "usd",
    stripe: { connected: false, charges_enabled: false, payouts_enabled: false, details_submitted: false },
  },
};

describe("useSellerAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore as unknown as { __reset: () => void }).__reset();
  });

  test("resolves to isLoading false with no seller when there is no stored session", async () => {
    const { result } = await renderHook(() => useSellerAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.seller).toBeNull();
    expect(mockedClient.getCurrentSeller).not.toHaveBeenCalled();
  });

  test("login stores the session token and sets the seller", async () => {
    mockedClient.loginSellerUser.mockResolvedValue("seller-token");
    mockedClient.getCurrentSeller.mockResolvedValue(sellerMe);

    const { result } = await renderHook(() => useSellerAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login("owner@shop.com", "pw");
    });

    expect(result.current.seller).toEqual(sellerMe);
    expect(await SecureStore.getItemAsync("bawi_seller_session")).toBe("seller-token");
  });

  test("logout clears the session token and the seller", async () => {
    mockedClient.loginSellerUser.mockResolvedValue("seller-token");
    mockedClient.getCurrentSeller.mockResolvedValue(sellerMe);

    const { result } = await renderHook(() => useSellerAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.login("owner@shop.com", "pw");
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.seller).toBeNull();
    expect(await SecureStore.getItemAsync("bawi_seller_session")).toBeNull();
  });

  test("drops a stale token on mount when getCurrentSeller fails", async () => {
    await SecureStore.setItemAsync("bawi_seller_session", "stale-token");
    mockedClient.getCurrentSeller.mockResolvedValue(null);

    const { result } = await renderHook(() => useSellerAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.seller).toBeNull();
    expect(await SecureStore.getItemAsync("bawi_seller_session")).toBeNull();
  });

  test("refresh re-fetches the current seller", async () => {
    await SecureStore.setItemAsync("bawi_seller_session", "seller-token");
    mockedClient.getCurrentSeller.mockResolvedValue(sellerMe);

    const { result } = await renderHook(() => useSellerAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.seller?.seller.status).toBe(sellerMe.seller.status);

    const updated = { ...sellerMe, seller: { ...sellerMe.seller, status: "suspended" } };
    mockedClient.getCurrentSeller.mockResolvedValue(updated);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.seller?.seller.status).toBe("suspended");
  });
});
