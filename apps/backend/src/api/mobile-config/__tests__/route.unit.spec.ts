import { GET } from "../route"

describe("mobile configuration", () => {
  const request = (keys: unknown[]) => ({
    scope: { resolve: () => ({ listApiKeys: jest.fn().mockResolvedValue(keys) }) },
  }) as never
  const response = () => {
    const res = {
      setHeader: jest.fn(),
      status: jest.fn(),
      json: jest.fn(),
    }
    res.status.mockReturnValue(res)
    return res
  }

  it("returns only an active publishable key", async () => {
    const res = response()
    await GET(request([
      { token: "pk_revoked", revoked_at: new Date(), deleted_at: null },
      { token: "pk_active", revoked_at: null, deleted_at: null },
    ]), res as never)
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store")
    expect(res.json).toHaveBeenCalledWith({ publishable_key: "pk_active" })
  })

  it("fails closed when no active key exists", async () => {
    const res = response()
    await GET(request([]), res as never)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(res.json).toHaveBeenCalledWith({ message: "Store configuration is unavailable" })
  })
})
