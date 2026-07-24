import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_APPLICATION_MODULE } from "../../modules/seller-application"
import type SellerApplicationModuleService from "../../modules/seller-application/service"
import { submitApplicationSchema } from "../../modules/seller-application/schemas"

/**
 * Public endpoint - anyone can apply. No auth, no publishable key: a
 * prospective seller has no account yet. Never accepts a status, seller_id,
 * or reviewer field from the client - those are server-only, set later by
 * an authenticated admin action.
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const parsed = submitApplicationSchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const sellerApplicationModuleService: SellerApplicationModuleService =
    req.scope.resolve(SELLER_APPLICATION_MODULE)

  const [existingPending] = await sellerApplicationModuleService.listSellerApplications(
    {
      business_email: parsed.data.business_email,
      status: ["submitted", "under_review"],
    },
    { take: 1 }
  )

  if (existingPending) {
    res.status(409).json({
      message:
        "An application for this email is already pending review. You'll be notified once it's been reviewed.",
    })
    return
  }

  const application = await sellerApplicationModuleService.createSellerApplications({
    ...parsed.data,
    // model.json() types as Record<string, unknown> - the column itself is
    // a plain jsonb accepting any valid JSON, arrays included.
    product_categories: parsed.data.product_categories as unknown as Record<
      string,
      unknown
    >,
    website_url: parsed.data.website_url || null,
    status: "submitted",
    submitted_at: new Date(),
  })

  res.status(201).json({
    application: {
      id: application.id,
      store_name: application.store_name,
      status: application.status,
      submitted_at: application.submitted_at,
    },
  })
}
