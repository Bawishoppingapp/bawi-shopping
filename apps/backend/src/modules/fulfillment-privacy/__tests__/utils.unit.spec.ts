import { generatePrivacyCode, PRIVACY_CODE_TTL_MS } from "../utils"

describe("generatePrivacyCode", () => {
  test("matches the expected XXXXX-XXXXX shape using only unambiguous characters", () => {
    const code = generatePrivacyCode()
    expect(code).toMatch(
      /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$/
    )
  })

  test("generates distinct codes across many calls", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generatePrivacyCode()))
    expect(codes.size).toBe(200)
  })
})

describe("PRIVACY_CODE_TTL_MS", () => {
  test("is a positive duration", () => {
    expect(PRIVACY_CODE_TTL_MS).toBeGreaterThan(0)
  })
})
