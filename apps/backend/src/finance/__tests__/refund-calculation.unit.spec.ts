import { calculateRefund } from "../refund-calculation"

describe("calculateRefund", () => {
  test("defaults to a full refund of the item's line_total when no amount is requested", () => {
    const result = calculateRefund(10000, 1500)
    expect(result).toEqual({
      refund_amount: 10000,
      commission_reversal_amount: 1500,
      net_reversal_amount: 8500,
      is_partial: false,
    })
  })

  test("a partial refund reverses commission proportionally to the refunded ratio", () => {
    // 50% of a 10000 line total refunded -> 50% of its 1500 commission reversed
    const result = calculateRefund(10000, 1500, 5000)
    expect(result).toEqual({
      refund_amount: 5000,
      commission_reversal_amount: 750,
      net_reversal_amount: 4250,
      is_partial: true,
    })
  })

  test("rounds the commission reversal to the nearest cent (round-half-up)", () => {
    // 1/3 of a 999 commission share = 333.0 exactly, but a non-exact ratio should round
    const result = calculateRefund(300, 100, 100)
    expect(result.commission_reversal_amount).toBe(33)
  })

  test("caps a requested amount above the line_total at the line_total", () => {
    const result = calculateRefund(10000, 1500, 999999)
    expect(result.refund_amount).toBe(10000)
    expect(result.is_partial).toBe(false)
  })

  test("floors a negative requested amount at zero", () => {
    const result = calculateRefund(10000, 1500, -500)
    expect(result.refund_amount).toBe(0)
    expect(result.commission_reversal_amount).toBe(0)
    expect(result.net_reversal_amount).toBe(0)
    expect(result.is_partial).toBe(true)
  })

  test("a zero line_total never divides by zero and produces a zero refund", () => {
    const result = calculateRefund(0, 0)
    expect(result).toEqual({
      refund_amount: 0,
      commission_reversal_amount: 0,
      net_reversal_amount: 0,
      is_partial: false,
    })
  })

  test("net_reversal_amount is always refund_amount minus commission_reversal_amount", () => {
    const result = calculateRefund(7777, 1111, 3333)
    expect(result.net_reversal_amount).toBe(result.refund_amount - result.commission_reversal_amount)
  })
})
