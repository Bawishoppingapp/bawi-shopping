import { formatMoney, formatUsd, priceRangeLabel } from "../utils/format-price";

describe("formatMoney", () => {
  test("formats USD with cents", () => {
    expect(formatMoney(4250, "usd")).toBe("$42.50");
  });

  test("formats ETB as whole Birr with thousands separator", () => {
    expect(formatMoney(212500, "etb")).toBe("Br 2,125");
  });

  test("rounds ETB to the nearest Birr", () => {
    expect(formatMoney(212549, "etb")).toBe("Br 2,125");
    expect(formatMoney(212550, "etb")).toBe("Br 2,126");
  });

  test("falls back to USD formatting for a null currency code", () => {
    expect(formatMoney(1000, null)).toBe("$10.00");
  });
});

describe("formatUsd", () => {
  test("is a thin wrapper around formatMoney with usd", () => {
    expect(formatUsd(999)).toBe("$9.99");
  });
});

describe("priceRangeLabel", () => {
  test("returns empty string when priceMin is null", () => {
    expect(priceRangeLabel({ priceMin: null, priceMax: null, currencyCode: "usd" })).toBe("");
  });

  test("returns a single formatted price when min equals max", () => {
    expect(priceRangeLabel({ priceMin: 1000, priceMax: 1000, currencyCode: "usd" })).toBe("$10.00");
  });

  test("returns a range when min and max differ", () => {
    expect(priceRangeLabel({ priceMin: 1000, priceMax: 2000, currencyCode: "usd" })).toBe("$10.00 – $20.00");
  });

  test("formats an ETB range with Br prefix on both ends", () => {
    expect(priceRangeLabel({ priceMin: 100000, priceMax: 250000, currencyCode: "etb" })).toBe("Br 1,000 – Br 2,500");
  });
});
