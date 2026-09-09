import { addCustomerMarkup, splitCustomerPrice } from "../customer-price"

describe("customer price markup", () => {
  test("adds a hidden 10% markup to the seller-entered amount", () => {
    expect(addCustomerMarkup(100_000, 1000)).toBe(110_000)
  })

  test("splits the retail amount back to exact seller earnings", () => {
    expect(splitCustomerPrice(110_000, 1000)).toEqual({ sellerAmount: 100_000, markupAmount: 10_000 })
  })
})
