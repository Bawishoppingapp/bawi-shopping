import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { SELLER_APPLICATION_MODULE } from "../../../modules/seller-application"
import type SellerApplicationModuleService from "../../../modules/seller-application/service"
import type { SellerApplicationStatus } from "../../../modules/seller-application/state-machine"

const VALID_STATUSES: SellerApplicationStatus[] = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "withdrawn",
]

/**
 * Admin-only (see middlewares.ts: authenticate("user", ...) on /admin/*).
 * Supports ?status=submitted to filter the review queue; omit for all.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const sellerApplicationModuleService: SellerApplicationModuleService =
    req.scope.resolve(SELLER_APPLICATION_MODULE)

  const statusParam = req.query.status
  const filters: Record<string, unknown> = {}

  if (typeof statusParam === "string" && VALID_STATUSES.includes(statusParam as SellerApplicationStatus)) {
    filters.status = statusParam
  }

  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0

  const [applications, count] =
    await sellerApplicationModuleService.listAndCountSellerApplications(filters, {
      take: limit,
      skip: offset,
      order: { submitted_at: "DESC" },
    })

  res.json({
    applications,
    count,
    limit,
    offset,
  })
}
