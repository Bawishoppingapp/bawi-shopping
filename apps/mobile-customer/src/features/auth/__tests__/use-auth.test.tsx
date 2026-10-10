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

  test("registration clears an unusable session and reports incomplete sign-in", async () => {
    mockedClient.registerCustomerAuthIdentity.mockResolvedValue("reg-token");
    mockedClient.createCustomer.mockResolvedValue({ id: "cus_1" });
    mockedClient.loginCustomer.mockResolvedValue("session-token");
    mockedClient.getCurrentCustomer.mockResolvedValue(null);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let failure: unknown;
    await act(async () => {
      try {
        await result.current.register({ firstName: "A", lastName: "B", email: "a@b.com", password: "pw" });
      } catch (error) {
        failure = error;
      }
    });
    expect(failure).toBeDefined();
    expect(result.current.customer).toBeNull();
    expect(await SecureStore.getItemAsync("bawi_customer_session")).toBeNull();
  });

  test("login clears a token that does not resolve to a customer", async () => {
    mockedClient.loginCustomer.mockResolvedValue("session-token");
    mockedClient.getCurrentCustomer.mockResolvedValue(null);

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let failure: unknown;
    await act(async () => {
      try {
        await result.current.login("a@b.com", "pw");
      } catch (error) {
        failure = error;
      }
    });
    expect(failure).toBeDefined();
    expect(await SecureStore.getItemAsync("bawi_customer_session")).toBeNull();
  });

  test("finishes a registration left with an actorless auth identity", async () => {
    const existingIdentity = new medusaAuthClient.MedusaAuthError("Identity with email already exists");
    existingIdentity.message = "Identity with email already exists";
    mockedClient.registerCustomerAuthIdentity.mockRejectedValueOnce(existingIdentity);
    mockedClient.loginCustomer.mockResolvedValueOnce("actorless-token").mockResolvedValueOnce("customer-token");
    mockedClient.getCurrentCustomer.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "cus_1", email: "a@b.com", first_name: "A", last_name: "B",
    });
    mockedClient.createCustomer.mockResolvedValue({ id: "cus_1" });
    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.register({ firstName: "A", lastName: "B", email: "a@b.com", password: "pw" });
    });
    expect(mockedClient.createCustomer).toHaveBeenCalledWith("actorless-token", {
      email: "a@b.com", first_name: "A", last_name: "B",
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

  test("deleteAccount deletes the remote account before clearing the local session", async () => {
    mockedClient.loginCustomer.mockResolvedValue("session-token");
    mockedClient.getCurrentCustomer.mockResolvedValue({
      id: "cus_1",
      email: "a@b.com",
      first_name: "A",
      last_name: "B",
    });
    mockedClient.deleteCustomerAccount.mockResolvedValue();

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.login("a@b.com", "pw");
    });

    await act(async () => {
      await result.current.deleteAccount();
    });

    expect(mockedClient.deleteCustomerAccount).toHaveBeenCalledWith("session-token");
    expect(result.current.customer).toBeNull();
    expect(await SecureStore.getItemAsync("bawi_customer_session")).toBeNull();
  });

  test("deleteAccount keeps the local session when the backend deletion fails", async () => {
    mockedClient.loginCustomer.mockResolvedValue("session-token");
    mockedClient.getCurrentCustomer.mockResolvedValue({
      id: "cus_1",
      email: "a@b.com",
      first_name: "A",
      last_name: "B",
    });
    mockedClient.deleteCustomerAccount.mockRejectedValue(new Error("server error"));

    const { result } = await renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.login("a@b.com", "pw");
    });

    await expect(result.current.deleteAccount()).rejects.toThrow("server error");

    expect(result.current.customer?.id).toBe("cus_1");
    expect(await SecureStore.getItemAsync("bawi_customer_session")).toBe("session-token");
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
