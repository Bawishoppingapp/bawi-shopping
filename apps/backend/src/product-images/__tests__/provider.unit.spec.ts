import { imageProvider } from "../provider"

describe("image gateway boundary", () => {
  const env = { ...process.env }
  afterEach(() => { process.env = { ...env }; jest.restoreAllMocks() })
  it("fails closed unless a backend key and HTTPS licensed face reference are configured", () => {
    delete process.env.BAWI_IMAGE_PROVIDER_KEY
    process.env.BAWI_IMAGE_MODEL_PROFILE = "licensed-profile"
    process.env.BAWI_IMAGE_FACE_REFERENCE_URL = "https://assets.example/model.png"
    expect(imageProvider()).toBeNull()
    process.env.BAWI_IMAGE_PROVIDER_KEY = "test-secret"
    for (const url of ["http://assets.example/model.png", "bad-url", "https://user:pass@assets.example/model.png", "https://assets.example/model.png?token=secret"]) {
      process.env.BAWI_IMAGE_FACE_REFERENCE_URL = url
      expect(imageProvider()).toBeNull()
    }
  })
  it("uses the native FASHN API with backend auth and returns durable-storage-ready base64", async () => {
    process.env.BAWI_IMAGE_FACE_REFERENCE_URL = "https://assets.example/model.png"
    process.env.BAWI_IMAGE_PROVIDER_KEY = "test-secret"
    process.env.BAWI_IMAGE_MODEL_PROFILE = "licensed-profile"
    const fetchMock = jest.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "job-123", error: null }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "job-123", status: "completed", output: ["data:image/png;base64,aGVsbG8="], error: null }) } as Response)
    const provider = imageProvider()!
    const sources = { front: "https://assets.example/front.png", back: "https://assets.example/back.png", attributes: {} } as any
    expect(await provider.generateStandardizedModelImage(sources, "licensed-profile", "workflow-1")).toEqual({ status: "pending", jobId: "job-123" })
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.fashn.ai/v1/run", expect.objectContaining({
      method: "POST", redirect: "error", headers: expect.objectContaining({ Authorization: "Bearer test-secret" }),
      body: expect.stringContaining('"model_name":"product-to-model"'),
    }))
    expect(await provider.getGenerationStatus("job-123")).toEqual({ status: "succeeded", jobId: "job-123", imageData: "data:image/png;base64,aGVsbG8=" })
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://api.fashn.ai/v1/status/job-123", expect.objectContaining({
      method: "GET", redirect: "error", headers: expect.objectContaining({ Authorization: "Bearer test-secret" }),
    }))
    await expect(provider.validateSourceImages(sources, "workflow-1:validate")).resolves.toMatchObject({ status: "ADMIN_REVIEW" })
  })
})
