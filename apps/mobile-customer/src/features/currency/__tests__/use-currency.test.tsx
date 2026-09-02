import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import type { ReactNode } from "react";

import { CurrencyProvider, useCurrency } from "../hooks/use-currency";

jest.mock("../services/currency-rates-client", () => ({
  getCurrencyRates: jest.fn(() => Promise.resolve({ usdToEtb: 150, updatedAt: "2026-09-01", provider: "test" })),
}));

const wrapper = ({ children }: { children: ReactNode }) => <CurrencyProvider>{children}</CurrencyProvider>;

describe("CurrencyProvider", () => {
  beforeEach(() => {
    (SecureStore as typeof SecureStore & { __reset: () => void }).__reset();
  });

  it("defaults to ETB, converts USD accurately, and persists a USD selection", async () => {
    const hook = await renderHook(() => useCurrency(), { wrapper });
    await waitFor(() => expect(hook.result.current.usdToEtb).toBe(150));

    expect(hook.result.current.currency).toBe("etb");
    expect(hook.result.current.formatPrice(5400, "usd")).toBe("Br 8,100");

    await act(async () => hook.result.current.setCurrency("usd"));
    expect(hook.result.current.formatPrice(212500, "etb")).toBe("$14.17");
    await waitFor(() => expect(SecureStore.setItemAsync).toHaveBeenCalledWith("bawi_display_currency", "usd"));
    await hook.unmount();
  });
});
