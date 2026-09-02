import { getCurrencyRates, resetCurrencyRatesCache } from "../currency-rates"

describe("currency rates cache", () => {
  beforeEach(() => {
    resetCurrencyRatesCache()
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        result: "success",
        rates: { ETB: 150.25 },
        time_last_update_utc: "2026-09-01T00:00:00Z",
      }),
    }) as jest.Mock
  })

  it("returns a validated USD/ETB snapshot and reuses it within 12 hours", async () => {
    const first = await getCurrencyRates(1_000)
    const second = await getCurrencyRates(2_000)

    expect(first.rates).toEqual({ usd: 1, etb: 150.25 })
    expect(second).toBe(first)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it("rejects invalid provider rates", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: "success", rates: { ETB: 0 } }),
    })
    await expect(getCurrencyRates()).rejects.toThrow("invalid ETB rate")
  })
})
