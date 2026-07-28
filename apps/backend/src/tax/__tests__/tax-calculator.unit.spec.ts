import { calculateMockTax } from "../tax-calculator"

describe("calculateMockTax", () => {
  test("applies the given flat rate to the taxable amount", () => {
    const result = calculateMockTax(10000, 825)
    expect(result).toEqual({ tax_amount: 825, tax_rate_basis_points: 825 })
  })

  test("rounds to the nearest cent", () => {
    // 333 * 0.0825 = 27.4725 -> rounds to 27
    const result = calculateMockTax(333, 825)
    expect(result.tax_amount).toBe(27)
  })

  test("a zero taxable amount produces zero tax", () => {
    const result = calculateMockTax(0, 825)
    expect(result.tax_amount).toBe(0)
  })

  test("a zero rate produces zero tax regardless of amount", () => {
    const result = calculateMockTax(10000, 0)
    expect(result.tax_amount).toBe(0)
  })
})
