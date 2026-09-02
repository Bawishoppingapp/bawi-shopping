import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { formatMoney } from "@/features/discovery/utils/format-price";
import { getCurrencyRates } from "../services/currency-rates-client";

export const DISPLAY_CURRENCIES = ["etb", "usd"] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];
const STORAGE_KEY = "bawi_display_currency";

interface CurrencyContextValue {
  currency: DisplayCurrency;
  setCurrency: (currency: DisplayCurrency) => void;
  usdToEtb: number | null;
  formatPrice: (minorUnits: number, sourceCurrency: string | null) => string;
  isConverted: (sourceCurrency: string | null) => boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function isDisplayCurrency(value: string | null): value is DisplayCurrency {
  return value === "etb" || value === "usd";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>("etb");
  const [usdToEtb, setUsdToEtb] = useState<number | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((stored) => {
      if (isDisplayCurrency(stored)) setCurrencyState(stored);
    });
    getCurrencyRates().then((rates) => setUsdToEtb(rates?.usdToEtb ?? null));
  }, []);

  const setCurrency = useCallback((next: DisplayCurrency) => {
    setCurrencyState(next);
    SecureStore.setItemAsync(STORAGE_KEY, next);
  }, []);

  const formatPrice = useCallback(
    (minorUnits: number, sourceCurrency: string | null) => {
      const source = sourceCurrency?.toLowerCase() === "etb" ? "etb" : "usd";
      if (source === currency || usdToEtb === null) return formatMoney(minorUnits, source);
      const converted = source === "usd" ? minorUnits * usdToEtb : minorUnits / usdToEtb;
      return formatMoney(Math.round(converted), currency);
    },
    [currency, usdToEtb],
  );

  const isConverted = useCallback(
    (sourceCurrency: string | null) => usdToEtb !== null && sourceCurrency?.toLowerCase() !== currency,
    [currency, usdToEtb],
  );

  const value = useMemo(
    () => ({ currency, setCurrency, usdToEtb, formatPrice, isConverted }),
    [currency, setCurrency, usdToEtb, formatPrice, isConverted],
  );

  // @ts-expect-error - same React Provider false positive as the app's other contexts
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const value = useContext(CurrencyContext);
  if (!value) throw new Error("useCurrency must be used within CurrencyProvider");
  return value;
}
