import { resolveCommission } from "../commission"

describe("resolveCommission", () => {
  test("uses the platform default rate when no seller override is given", () => {
    const result = resolveCommission(10000, 1500)
    expect(result).toEqual({ commission_rate_basis_points: 1500, commission_amount: 1500 })
  })

  test("prefers a seller-specific override over the platform default", () => {
    const result = resolveCommission(10000, 1500, 1000)
    expect(result).toEqual({ commission_rate_basis_points: 1000, commission_amount: 1000 })
  })

  test("rounds to the nearest cent (round-half-up)", () => {
    // 333 * 0.15 = 49.95 -> rounds to 50
    const result = resolveCommission(333, 1500)
    expect(result.commission_amount).toBe(50)
  })

  test("a zero subtotal produces zero commission", () => {
    const result = resolveCommission(0, 1500)
    expect(result.commission_amount).toBe(0)
  })

  test("a null override falls back to the platform default rather than treating it as zero", () => {
    const result = resolveCommission(10000, 1500, null)
    expect(result.commission_rate_basis_points).toBe(1500)
  })
})
