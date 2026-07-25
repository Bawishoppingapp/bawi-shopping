import { encodeCursor, decodeCursor } from "../postgres-search-service"

describe("cursor encode/decode", () => {
  test("round-trips an offset", () => {
    expect(decodeCursor(encodeCursor(24))).toBe(24)
  })

  test("round-trips zero", () => {
    expect(decodeCursor(encodeCursor(0))).toBe(0)
  })

  test("decodes undefined as offset 0 (first page)", () => {
    expect(decodeCursor(undefined)).toBe(0)
  })

  test("decodes a malformed cursor as offset 0 rather than throwing", () => {
    expect(decodeCursor("not-a-valid-cursor")).toBe(0)
  })

  test("decodes a negative-offset cursor as 0", () => {
    expect(decodeCursor(encodeCursor(-5))).toBe(0)
  })
})
