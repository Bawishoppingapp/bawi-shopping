import { generateFulfillmentCode } from "../fulfillment-code"

describe("generateFulfillmentCode", () => {
  test("matches the expected FC-XXXX-XXXX shape using only unambiguous characters", () => {
    const code = generateFulfillmentCode()
    expect(code).toMatch(/^FC-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/)
  })

  test("generates distinct codes across many calls", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateFulfillmentCode()))
    expect(codes.size).toBe(200)
  })
})
