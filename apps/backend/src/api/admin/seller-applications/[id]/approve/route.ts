import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SELLER_APPLICATION_MODULE } from "../../../../../modules/seller-application"
import type SellerApplicationModuleService from "../../../../../modules/seller-application/service"
import { isValidTransition } from "../../../../../modules/seller-application/state-machine"
import { generateUniqueSlug } from "../../../../../modules/seller-application/utils"
import { SELLER_MODULE } from "../../../../../modules/seller"
import type SellerModuleService from "../../../../../modules/seller/service"
import { approveSellerApplicationWorkflow } from "../../../../../workflows/approve-seller-application"

/**
 * Admin-only (see middlewares.ts). The admin's identity is always read from
 * req.auth_context.actor_id - the authenticated Medusa `user` id - never
 * from anything the client sends, so the audit trail can't be spoofed.
 *
 * Idempotent: if this application was already approved (seller_id set),
 * re-calling this route returns the existing seller/seller_user rather
 * than creating duplicates. This guards the realistic case (double click,
 * retried request); a true concurrent-request race is a known residual
 * risk noted in docs/DECISIONS.md.
 *
 * The actual writes (seller, seller_user, application, audit log) run
 * inside approveSellerApplicationWorkflow so they're all-or-nothing - see
 * docs/DECISIONS.md for why a workflow rather than a raw DB transaction.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const sellerApplicationModuleService: SellerApplicationModuleService =
    req.scope.resolve(SELLER_APPLICATION_MODULE)
  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)

  let application
  try {
    application = await sellerApplicationModuleService.retrieveSellerApplication(
      req.params.id
    )
  } catch {
    res.status(404).json({ message: "Application not found" })
    return
  }

  const adminUserId = req.auth_context.actor_id

  if (application.seller_id) {
    // Already approved - idempotent no-op, no duplicate vendor/user, no
    // duplicate audit entry (nothing actually changed on this call).
    const seller = await sellerModuleService.retrieveSeller(application.seller_id)
    res.json({ application, seller, already_approved: true })
    return
  }

  if (!isValidTransition(application.status, "approved")) {
    res.status(422).json({
      message: `Cannot approve an application with status "${application.status}"`,
    })
    return
  }

  const previousStatus = application.status

  const slug = await generateUniqueSlug(application.store_name, async (candidate) => {
    const [existing] = await sellerModuleService.listSellers({ slug: candidate })
    return Boolean(existing)
  })

  const { result } = await approveSellerApplicationWorkflow(req.scope).run({
    input: {
      applicationId: application.id,
      storeName: application.store_name,
      slug,
      businessEmail: application.business_email,
      adminUserId,
      previousStatus,
      currencyCode: application.currency_code,
    },
  })

  const sellerPortalUrl = process.env.SELLER_PORTAL_URL ?? "http://localhost:3001"

  res.json({
    application: result.application,
    seller: result.seller,
    seller_user: { id: result.sellerUser.id, email: result.sellerUser.email },
    activation_link: `${sellerPortalUrl}/activate?token=${result.sellerUser.activation_token}`,
  })
}
