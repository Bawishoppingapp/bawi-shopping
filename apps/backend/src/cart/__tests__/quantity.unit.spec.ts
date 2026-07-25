import { validateRequestedQuantity } from "../quantity"

describe("validateRequestedQuantity", () => {
  const limits = { availableQuantity: 5, maxQuantityPerLineItem: 10 }

  test("accepts a positive whole number within both limits", () => {
    expect(validateRequestedQuantity(3, limits)).toEqual({ ok: true })
  })

  test.each([0, -1, 1.5, Number.NaN])("rejects a non-positive or non-integer quantity: %p", (q) => {
    expect(validateRequestedQuantity(q, limits)).toEqual({ ok: false, reason: "invalid" })
  })

  test("rejects a quantity above the configurable maximum", () => {
    expect(validateRequestedQuantity(11, limits)).toEqual({ ok: false, reason: "exceeds_max" })
  })

  test("rejects a quantity above currently available inventory", () => {
    expect(validateRequestedQuantity(6, limits)).toEqual({ ok: false, reason: "exceeds_inventory" })
  })

  test("the max-quantity check runs before the inventory check when both are exceeded", () => {
    const tightLimits = { availableQuantity: 2, maxQuantityPerLineItem: 5 }
    expect(validateRequestedQuantity(9, tightLimits)).toEqual({ ok: false, reason: "exceeds_max" })
  })

  test("accepts a quantity exactly at the available-inventory boundary", () => {
    expect(validateRequestedQuantity(5, limits)).toEqual({ ok: true })
  })

  test("accepts a quantity exactly at the max-quantity boundary", () => {
    const looseLimits = { availableQuantity: 100, maxQuantityPerLineItem: 10 }
    expect(validateRequestedQuantity(10, looseLimits)).toEqual({ ok: true })
  })
})
