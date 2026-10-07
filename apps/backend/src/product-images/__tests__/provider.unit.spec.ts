import { imageProvider } from "../provider"

describe("image gateway boundary", () => {
  const env = { ...process.env }
  afterEach(() => { process.env = { ...env }; jest.restoreAllMocks() })
  it("fails closed for absent configuration and insecure endpoints", () => {
    delete process.env.BAWI_IMAGE_PROVIDER_KEY
    expect(imageProvider()).toBeNull()
    process.env.BAWI_IMAGE_PROVIDER_KEY = "test-secret"
    process.env.BAWI_IMAGE_MODEL_PROFILE = "licensed-profile"
    for (const url of ["http://example.com", "bad-url", "https://user:pass@example.com"]) {
      process.env.BAWI_IMAGE_PROVIDER_URL = url
      expect(imageProvider()).toBeNull()
    }
  })
  it("uses backend authentication, idempotency and strict result schemas", async () => {
    process.env.BAWI_IMAGE_PROVIDER_URL = "https://adapter.example/v1"
    process.env.BAWI_IMAGE_PROVIDER_KEY = "test-secret"
    process.env.BAWI_IMAGE_MODEL_PROFILE = "licensed-profile"
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ status: "succeeded", jobId: "job", imageUrl: "http://unsafe.example/image" }) } as Response)
    await expect(imageProvider()!.getGenerationStatus("job")).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledWith("https://adapter.example/v1/generations/job", expect.objectContaining({ redirect: "error", headers: expect.objectContaining({ Authorization: "Bearer test-secret" }) }))
  })
})
