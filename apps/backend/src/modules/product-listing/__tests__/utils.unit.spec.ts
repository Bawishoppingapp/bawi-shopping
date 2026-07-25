import { generateUniqueProductCode } from "../utils"

describe("generateUniqueProductCode", () => {
  test("generates a code matching the BW-XXXXXXXX pattern", async () => {
    const code = await generateUniqueProductCode(async () => false)
    expect(code).toMatch(/^BW-[0-9A-F]{8}$/)
  })

  test("retries when the candidate is already taken", async () => {
    let calls = 0
    const isTaken = async () => {
      calls += 1
      return calls === 1
    }
    const code = await generateUniqueProductCode(isTaken)
    expect(calls).toBeGreaterThanOrEqual(2)
    expect(code).toMatch(/^BW-[0-9A-F]{8}$/)
  })

  test("two calls produce different codes with overwhelming probability", async () => {
    const codeA = await generateUniqueProductCode(async () => false)
    const codeB = await generateUniqueProductCode(async () => false)
    expect(codeA).not.toBe(codeB)
  })
})
