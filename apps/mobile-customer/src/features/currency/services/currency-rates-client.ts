const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

export interface CurrencyRates {
  usdToEtb: number;
  updatedAt: string;
  provider: string;
}

let request: Promise<CurrencyRates | null> | null = null;

async function fetchCurrencyRates(): Promise<CurrencyRates | null> {
  try {
    const response = await fetch(`${MEDUSA_BACKEND_URL}/currency-rates`);
    if (!response.ok) return null;
    const data = await response.json();
    const rate = data?.rates?.etb;
    if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return null;
    return { usdToEtb: rate, updatedAt: data.updated_at, provider: data.provider };
  } catch {
    return null;
  }
}

/** One request per app session. The backend owns refresh/staleness policy. */
export function getCurrencyRates(): Promise<CurrencyRates | null> {
  request ??= fetchCurrencyRates();
  return request;
}
