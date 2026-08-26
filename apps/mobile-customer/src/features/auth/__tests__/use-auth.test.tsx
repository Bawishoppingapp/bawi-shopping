import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";

import { AuthProvider, useAuth } from "../hooks/use-auth";
import * as medusaAuthClient from "../services/medusa-auth-client";

jest.mock("../services/medusa-auth-client");

const mockedClient = medusaAuthClient as jest.Mocked<typeof medusaAuthClient>;

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("useAuth", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (SecureStore as unknown as { __reset: () => void }).__reset();
  });

  test("resolves to isLoading false with no customer when there is no stored session", async () => {
    const { result } = await renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.customer).toBeNull();
  });

  test("login stores the session token and sets the customer", async () => {
    mockedClient.loginCustomer.mockResolvedValue("session-token");
    mockedClient.getCurrentCustomer.mockResolvedValue({
      id: "cus_1",
      email: "a@b.com",
      first_name: "A",
      last_name: "B",
    });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login("a@b.com", "pw");
    });

    expect(result.current.customer).toEqual({ id: "cus_1", email: "a@b.com", first_name: "A", last_name: "B" });
    expect(await SecureStore.getItemAsync("bawi_customer_session")).toBe("session-token");
  });

  test("register runs the full registration sequence and signs the customer in", async () => {
    mockedClient.registerCustomerAuthIdentity.mockResolvedValue("reg-token");
    mockedClient.createCustomer.mockResolvedValue({ id: "cus_1" });
    mockedClient.loginCustomer.mockResolvedValue("session-token");
    mockedClient.getCurrentCustomer.mockResolvedValue({
      id: "cus_1",
      email: "a@b.com",
      first_name: "A",
      last_name: "B",
    });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.register({ firstName: "A", lastName: "B", email: "a@b.com", password: "pw" });
    });

    expect(mockedClient.registerCustomerAuthIdentity).toHaveBeenCalledWith("a@b.com", "pw");
    expect(mockedClient.createCustomer).toHaveBeenCalledWith("reg-token", {
      email: "a@b.com",
      first_name: "A",
      last_name: "B",
    });
    expect(result.current.customer?.id).toBe("cus_1");
  });

  test("logout clears the session token and the customer", async () => {
    mockedClient.loginCustomer.mockResolvedValue("session-token");
    mockedClient.getCurrentCustomer.mockResolvedValue({
      id: "cus_1",
      email: "a@b.com",
      first_name: "A",
      last_name: "B",
    });

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.login("a@b.com", "pw");
    });
    expect(result.current.customer).not.toBeNull();

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.customer).toBeNull();
    expect(await SecureStore.getItemAsync("bawi_customer_session")).toBeNull();
  });

  test("drops a stale token on mount when getCurrentCustomer fails", async () => {
    await SecureStore.setItemAsync("bawi_customer_session", "stale-token");
    mockedClient.getCurrentCustomer.mockResolvedValue(null);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.customer).toBeNull();
    expect(await SecureStore.getItemAsync("bawi_customer_session")).toBeNull();
  });
});
