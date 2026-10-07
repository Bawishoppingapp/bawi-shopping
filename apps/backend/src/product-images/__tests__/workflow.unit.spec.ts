import { imageAction, processImage } from "../service"
import { imageProvider } from "../provider"
import { sourceSchema, ownedSources } from "../contracts"
import { Modules } from "@medusajs/framework/utils"
import { PRODUCT_LISTING_MODULE } from "../../modules/product-listing"
import { AUDIT_LOG_MODULE } from "../../modules/audit-log"

jest.mock("../provider", () => ({ imageProvider: jest.fn() }))
jest.mock("@medusajs/medusa/core-flows", () => ({ uploadFilesWorkflow: jest.fn(() => ({ run: async () => ({ result: [{ url: "https://stored.example/hero.png" }] }) })) }))
const sources = { front: "https://images.example/front.jpg", back: "https://images.example/back.jpg", attributes: { category: "dress", color: "red", material: "cotton", pattern: "plain", sleeves: "short", neckline: "round", length: "midi", fit: "regular", sizes: "S–L" } }
const seller = { type: "seller_user" as const, id: "seller-user", vendorId: "vendor-1" }
const admin = { type: "user" as const, id: "admin" }
function setup() {
  let listing: Record<string, any> = { id: "listing-1", vendor_id: "vendor-1", product_id: "product-1", ai_image_workflow: null }
  const provider = { name: "test-provider", validateSourceImages: jest.fn().mockResolvedValue({ status: "APPROVED", reasons: [] }), generateStandardizedModelImage: jest.fn().mockResolvedValue({ status: "pending", jobId: "job-1" }), getGenerationStatus: jest.fn().mockResolvedValue({ status: "succeeded", jobId: "job-1", imageData: "data:image/png;base64,aGVsbG8=" }) }
  ;(imageProvider as jest.Mock).mockReturnValue(provider)
  const updateProducts = jest.fn()
  const audit = { record: jest.fn().mockResolvedValue({}) }
  const modules = {
    [Modules.LOCKING]: { execute: async (_: string, fn: () => Promise<unknown>) => fn() },
    [Modules.PRODUCT]: { retrieveProduct: jest.fn().mockResolvedValue({ images: [{ url: sources.front }, { url: sources.back }] }), updateProducts },
    [PRODUCT_LISTING_MODULE]: { retrieveProductListing: jest.fn(async () => listing), updateProductListings: jest.fn(async (value) => { listing = { ...listing, ...value }; return listing }) },
    [AUDIT_LOG_MODULE]: audit,
  }
  const container = { resolve: (key: string) => modules[key] } as any
  return { container, provider, audit, updateProducts, get: () => listing }
}

describe("product image workflow", () => {
  beforeEach(() => { process.env.BAWI_IMAGE_MODEL_PROFILE = "licensed-profile" })
  it("requires separate front/back and complete attributes owned by the product", () => {
    expect(sourceSchema.safeParse({ ...sources, back: sources.front }).success).toBe(false)
    expect(sourceSchema.safeParse({ ...sources, attributes: {} }).success).toBe(false)
    expect(ownedSources(sources, [sources.front])).toBe(false)
  })
  it("blocks another seller and unowned source images", async () => {
    const { container, provider } = setup()
    await expect(imageAction(container, "listing-1", { ...seller, vendorId: "other" }, "request", sources)).rejects.toThrow("Product not found")
    await expect(imageAction(container, "listing-1", seller, "request", { ...sources, back: "https://other.example/back.jpg" })).rejects.toThrow("original gallery")
    expect(provider.generateStandardizedModelImage).not.toHaveBeenCalled()
  })
  it("does not create a fake job without a configured provider", async () => {
    const { container, get } = setup()
    ;(imageProvider as jest.Mock).mockReturnValue(null)
    await expect(imageAction(container, "listing-1", seller, "request", sources)).rejects.toThrow("not configured")
    expect(get().ai_image_workflow).toBeNull()
  })
  it.each(["NEEDS_CORRECTION", "ADMIN_REVIEW"])("never spends generation credits on %s sources", async (status) => {
    const { container, provider, get } = setup()
    provider.validateSourceImages.mockResolvedValue({ status, reasons: ["Use a brighter full-garment front photo"] })
    await imageAction(container, "listing-1", seller, "request", sources)
    await processImage(container, "listing-1")
    await processImage(container, "listing-1")
    expect(get().ai_image_pending).toBe(false)
    expect(provider.generateStandardizedModelImage).not.toHaveBeenCalled()
    if (status === "ADMIN_REVIEW") {
      await expect(imageAction(container, "listing-1", seller, "approve_source")).rejects.toThrow()
      await imageAction(container, "listing-1", admin, "approve_source")
      await processImage(container, "listing-1")
      expect(provider.generateStandardizedModelImage).toHaveBeenCalledTimes(1)
    }
  })
  it("runs asynchronously, deduplicates taps, keeps originals and publishes only after admin approval", async () => {
    const { container, provider, get, audit, updateProducts } = setup()
    const first = await imageAction(container, "listing-1", seller, "request", sources)
    const repeated = await imageAction(container, "listing-1", seller, "request", sources)
    expect(first.id).toBe(repeated.id)
    expect(provider.generateStandardizedModelImage).not.toHaveBeenCalled()
    await expect(imageAction(container, "listing-1", admin, "approve")).rejects.toThrow()
    await processImage(container, "listing-1")
    await processImage(container, "listing-1")
    expect(get().ai_image_workflow.status).toBe("generating")
    await processImage(container, "listing-1")
    expect(get().ai_preview_status).toBe("generated")
    await imageAction(container, "listing-1", seller, "approve")
    expect(get().ai_preview_status).toBe("generated")
    await imageAction(container, "listing-1", admin, "approve")
    expect(get().ai_preview_status).toBe("approved")
    expect(updateProducts).not.toHaveBeenCalled()
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "product.image_approve", actorType: "user" }))
    await imageAction(container, "listing-1", seller, "mismatch", "Wrong neckline")
    expect(get().ai_preview_status).not.toBe("approved")
  })
  it("blocks retry after an ambiguous provider submission to prevent duplicate charges", async () => {
    const { container, provider, get } = setup()
    await imageAction(container, "listing-1", seller, "request", sources)
    await processImage(container, "listing-1")
    provider.generateStandardizedModelImage.mockRejectedValueOnce(new Error("timeout with private provider details"))
    await processImage(container, "listing-1")
    const id = get().ai_image_workflow.id
    expect(get().ai_image_workflow.error).toBe("provider_error")
    expect(JSON.stringify(get())).not.toContain("private provider details")
    expect(provider.generateStandardizedModelImage.mock.calls.map((c) => c[2])).toEqual([id])
    await expect(imageAction(container, "listing-1", seller, "retry")).rejects.toThrow("Reconcile the provider job")
    await expect(imageAction(container, "listing-1", seller, "regenerate")).rejects.toThrow("Reconcile the provider job")
    await processImage(container, "listing-1")
    expect(provider.generateStandardizedModelImage).toHaveBeenCalledTimes(1)
  })
  it("records terminal generation failure without blocking the product", async () => {
    const { container, provider, get } = setup()
    await imageAction(container, "listing-1", seller, "request", sources)
    await processImage(container, "listing-1")
    provider.generateStandardizedModelImage.mockResolvedValue({ status: "failed", jobId: "job-1" })
    await processImage(container, "listing-1")
    expect(get().ai_image_workflow.status).toBe("failed")
    expect(get().ai_image_pending).toBe(false)
    expect(get().status).toBeUndefined()
  })
})
