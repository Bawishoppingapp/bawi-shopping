import { isCartExpired } from "../expiration"

describe("isCartExpired", () => {
  const now = new Date("2026-07-25T00:00:00.000Z")

  test("a cart updated moments ago is not expired", () => {
    const updatedAt = new Date("2026-07-24T23:00:00.000Z")
    expect(isCartExpired(updatedAt, now, 30)).toBe(false)
  })

  test("a cart updated well past the expiration window is expired", () => {
    const updatedAt = new Date("2026-06-01T00:00:00.000Z")
    expect(isCartExpired(updatedAt, now, 30)).toBe(true)
  })

  test("a cart exactly at the expiration boundary is not yet expired", () => {
    const updatedAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    expect(isCartExpired(updatedAt, now, 30)).toBe(false)
  })

  test("one millisecond past the boundary is expired", () => {
    const updatedAt = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000 - 1)
    expect(isCartExpired(updatedAt, now, 30)).toBe(true)
  })
})
