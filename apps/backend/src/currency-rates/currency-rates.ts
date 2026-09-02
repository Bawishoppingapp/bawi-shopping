const RATE_URL = "https://open.er-api.com/v6/latest/USD"
const FRESH_FOR_MS = 12 * 60 * 60 * 1000
const MAX_STALE_MS = 48 * 60 * 60 * 1000

export interface CurrencyRatesSnapshot {
  base_code: "usd"
  rates: { usd: 1; etb: number }
  updated_at: string
  provider: "ExchangeRate-API"
}

let cached: { value: CurrencyRatesSnapshot; fetchedAt: number } | null = null
let inFlight: Promise<CurrencyRatesSnapshot> | null = null

function isUsableRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

async function fetchLatestRates(): Promise<CurrencyRatesSnapshot> {
  const response = await fetch(RATE_URL, { signal: AbortSignal.timeout(5000) })
  if (!response.ok) throw new Error(`FX provider returned ${response.status}`)

  const payload = (await response.json()) as {
    result?: string
    rates?: Record<string, unknown>
    time_last_update_utc?: string
  }
  const etb = payload.rates?.ETB
  if (payload.result !== "success" || !isUsableRate(etb)) {
    throw new Error("FX provider returned an invalid ETB rate")
  }

  return {
    base_code: "usd",
    rates: { usd: 1, etb },
    updated_at: payload.time_last_update_utc ?? new Date().toISOString(),
    provider: "ExchangeRate-API",
  }
}

/** One upstream request per backend process every 12 hours. If a refresh
 * fails, the last successful rate remains usable for up to 48 hours; after
 * that callers fail closed instead of displaying an unsafe conversion. */
export async function getCurrencyRates(now = Date.now()): Promise<CurrencyRatesSnapshot> {
  if (cached && now - cached.fetchedAt < FRESH_FOR_MS) return cached.value
  if (inFlight) return inFlight

  inFlight = fetchLatestRates()
    .then((value) => {
      cached = { value, fetchedAt: now }
      return value
    })
    .catch((error) => {
      if (cached && now - cached.fetchedAt < MAX_STALE_MS) return cached.value
      throw error
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

export function resetCurrencyRatesCache(): void {
  cached = null
  inFlight = null
}
