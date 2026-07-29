import { rateLimit, resetRateLimiterState } from "../rate-limiter"

function mockReqRes(ip: string) {
  const req = { ip } as any
  const json = jest.fn()
  const status = jest.fn().mockReturnValue({ json })
  const res = { status } as any
  const next = jest.fn()
  return { req, res, next, status, json }
}

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimiterState()
  })

  it("allows requests under the limit", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 3 })
    const { req, res, next } = mockReqRes("1.1.1.1")

    middleware(req, res, next)
    middleware(req, res, next)
    middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(3)
    expect(res.status).not.toHaveBeenCalled()
  })

  it("rejects the request once the limit is exceeded within the window", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 2, message: "slow down" })
    const { req, res, next, status, json } = mockReqRes("2.2.2.2")

    middleware(req, res, next)
    middleware(req, res, next)
    middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(2)
    expect(status).toHaveBeenCalledWith(429)
    expect(json).toHaveBeenCalledWith({ message: "slow down" })
  })

  it("tracks separate buckets per IP", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 1 })
    const a = mockReqRes("3.3.3.3")
    const b = mockReqRes("4.4.4.4")

    middleware(a.req, a.res, a.next)
    middleware(a.req, a.res, a.next) // a's second request is rejected
    middleware(b.req, b.res, b.next) // b is unaffected by a's usage

    expect(a.next).toHaveBeenCalledTimes(1)
    expect(a.status).toHaveBeenCalledWith(429)
    expect(b.next).toHaveBeenCalledTimes(1)
    expect(b.status).not.toHaveBeenCalled()
  })

  it("resets the count once the window has elapsed", () => {
    const middleware = rateLimit({ windowMs: 10, max: 1 })
    const { req, res, next } = mockReqRes("5.5.5.5")

    middleware(req, res, next)
    expect(next).toHaveBeenCalledTimes(1)

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        middleware(req, res, next)
        expect(next).toHaveBeenCalledTimes(2)
        resolve()
      }, 20)
    })
  })

  it("falls back to a default message when none is provided", () => {
    const middleware = rateLimit({ windowMs: 60_000, max: 0 })
    const { req, res, json } = mockReqRes("6.6.6.6")
    const next = jest.fn()

    middleware(req, res, next)

    expect(json).toHaveBeenCalledWith({
      message: "Too many requests. Please try again later.",
    })
  })
})
