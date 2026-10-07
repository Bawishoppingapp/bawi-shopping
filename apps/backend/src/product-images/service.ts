import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { PRODUCT_LISTING_MODULE } from "../modules/product-listing"
import type ProductListingModuleService from "../modules/product-listing/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { sourceSchema, ownedSources, pending, type ImageWorkflow } from "./contracts"
import { imageProvider } from "./provider"

type Actor = { type: "seller_user" | "user" | "system"; id: string | null; vendorId?: string }
const conflict = (message: string): never => { throw new MedusaError(MedusaError.Types.NOT_ALLOWED, message) }
export async function imageAction(container: MedusaContainer, id: string, actor: Actor, action: string, input?: unknown) {
  return container.resolve(Modules.LOCKING).execute(`product-image:${id}`, async () => {
    const listings: ProductListingModuleService = container.resolve(PRODUCT_LISTING_MODULE)
    const listing = await listings.retrieveProductListing(id)
    if (actor.type === "seller_user" && actor.vendorId !== listing.vendor_id) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Product not found")
    const previous = listing.ai_image_workflow as ImageWorkflow | null
    let state = previous ? { ...previous } : null
    if (action === "request" || action === "regenerate") {
      if (!imageProvider()) return conflict("AI image generation is not configured")
      if (state && pending(state)) return state // Repeated taps cannot spend twice.
      if (action === "regenerate" && (!state || !["review", "rejected", "failed"].includes(state.status))) return conflict("Review the current image first")
      if (action === "request" && state && !["needs_correction", "rejected", "failed"].includes(state.status)) return conflict("Review the current image first")
      const parsed = sourceSchema.safeParse(action === "regenerate" ? state?.sources : input)
      if (!parsed.success) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Choose distinct front/back photos and complete all garment attributes")
      const sources = parsed.data
      const product = await container.resolve(Modules.PRODUCT).retrieveProduct(listing.product_id, { relations: ["images"] })
      if (!ownedSources(sources, product.images?.map((image) => image.url) ?? [])) return conflict("Choose source photos from this product's original gallery")
      const count = previous ? previous.regenerationCount + 1 : 0
      if (count > 3 && actor.type !== "user") return conflict("Ask Bawi to review further regeneration requests")
      state = { id: randomUUID(), sources, modelProfile: process.env.BAWI_IMAGE_MODEL_PROFILE!, provider: imageProvider()!.name, status: "validating", validation: null, regenerationCount: count, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    } else {
      if (!state) return conflict("Request an image first")
      if (action === "retry") {
        if (state.status !== "failed") return conflict("Only failed jobs can be retried")
        if (!imageProvider()) return conflict("AI image generation is not configured")
        state.status = state.validation?.status === "APPROVED" ? "queued" : "validating"
        state.createdAt = new Date().toISOString()
        delete state.error
      } else if (action === "approve_source") {
        if (actor.type !== "user" || state.status !== "admin_review") return conflict("Source review is required")
        state.validation = { status: "APPROVED", reasons: ["Source approved by Bawi review"] }; state.status = "queued"
      } else if (action === "approve") {
        if (state.status !== "review" || !state.imageUrl) return conflict("No generated image is ready for review")
        if (actor.type === "seller_user") state.sellerApproved = true
        else if (actor.type === "user") state.status = "approved"
        else return conflict("A human must approve the image")
      } else if (action === "reject" || action === "mismatch") {
        if (!["review", "approved", "admin_review"].includes(state.status)) return conflict("Nothing is awaiting review")
        const reason = typeof input === "string" ? input.trim() : ""
        if (reason.length < 3 || reason.length > 500) return conflict("Give a reason between 3 and 500 characters")
        state.status = action === "mismatch" ? "admin_review" : "rejected"
        state.sellerApproved = false
        state.validation = { status: "ADMIN_REVIEW", reasons: [reason] }
      } else return conflict("Unknown image action")
    }
    state.updatedAt = new Date().toISOString()
    await listings.updateProductListings({ id, ai_image_workflow: state, ai_image_pending: pending(state),
      ai_preview_status: state.status === "approved" ? "approved" : state.status === "review" ? "generated" : "not_requested",
      ai_preview_url: state.imageUrl ?? null,
      ...(state.status === "approved" ? { ai_preview_reviewed_by: actor.id, ai_preview_reviewed_at: new Date() } : {}),
    })
    const audit: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    await audit.record({ actorType: actor.type, actorId: actor.id, action: `product.image_${action}`, entityType: "product_listing", entityId: id, vendorId: listing.vendor_id, beforeState: previous, afterState: state })
    return state
  })
}

export async function processImage(container: MedusaContainer, id: string) {
  return container.resolve(Modules.LOCKING).execute(`product-image:${id}`, async () => {
    const listings: ProductListingModuleService = container.resolve(PRODUCT_LISTING_MODULE)
    const listing = await listings.retrieveProductListing(id)
    const previous = listing.ai_image_workflow as ImageWorkflow | null
    if (!previous || !pending(previous)) return
    const state = { ...previous }
    const provider = imageProvider()
    try {
      if (!provider || provider.name !== state.provider) { state.status = "failed"; state.error = "provider_unavailable" }
      else if (Date.now() - Date.parse(state.createdAt) > 24 * 60 * 60 * 1000) { state.status = "failed"; state.error = "generation_timeout" }
      else if (state.status === "validating") {
        state.validation = await provider.validateSourceImages(state.sources, state.id)
        state.status = state.validation.status === "APPROVED" ? "queued" : state.validation.status === "NEEDS_CORRECTION" ? "needs_correction" : "admin_review"
      } else {
        const result = state.jobId ? await provider.getGenerationStatus(state.jobId) : await provider.generateStandardizedModelImage(state.sources, state.modelProfile, state.id)
        state.jobId = result.jobId
        if (result.status === "succeeded") { state.status = "review"; state.imageUrl = result.imageUrl }
        else if (result.status === "failed") { state.status = "failed"; state.error = "generation_failed" }
        else state.status = "generating"
      }
    } catch { state.status = "failed"; state.error = "provider_error" }
    state.updatedAt = new Date().toISOString()
    await listings.updateProductListings({ id, ai_image_workflow: state, ai_image_pending: pending(state),
      ...(state.status === "review" ? { ai_preview_url: state.imageUrl, ai_preview_status: "generated", ai_preview_generated_by: state.provider, ai_preview_generated_at: new Date() } : {}),
    })
    if (state.status !== previous.status) {
      const audit: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
      await audit.record({ actorType: "system", actorId: null, action: "product.image_progress", entityType: "product_listing", entityId: id, vendorId: listing.vendor_id, beforeState: previous, afterState: state })
    }
  })
}
