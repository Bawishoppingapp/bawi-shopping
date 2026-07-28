import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FULFILLMENT_PRIVACY_MODULE } from "../../../modules/fulfillment-privacy"
import type FulfillmentPrivacyModuleService from "../../../modules/fulfillment-privacy/service"
import { createCourierSchema } from "../../../fulfillment/schemas"
import { provisionCourierWorkflow } from "../../../workflows/provision-courier"

const COURIER_PORTAL_URL = process.env.COURIER_PORTAL_URL ?? "http://localhost:3002/courier"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = req.scope.resolve(
    FULFILLMENT_PRIVACY_MODULE
  )
  const couriers = await fulfillmentPrivacyModuleService.listCouriers(
    {},
    { order: { created_at: "DESC" } }
  )
  res.json({
    couriers: couriers.map((courier) => ({
      id: courier.id,
      name: courier.name,
      email: courier.email,
      status: courier.status,
      activated: Boolean(courier.auth_identity_id),
    })),
  })
}

/**
 * Admin provisions a courier account directly - no self-service courier
 * application flow (couriers are Bawi contractors/employees, see
 * docs/DECISIONS.md). No email service exists yet, so the activation link
 * is returned directly in this response for the admin to relay manually -
 * same documented stand-in as seller-application approval.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = createCourierSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" })
    return
  }

  const { result: courier } = await provisionCourierWorkflow(req.scope).run({
    input: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      adminUserId: req.auth_context.actor_id,
    },
  })

  res.json({
    courier: { id: courier.id, name: courier.name, email: courier.email },
    activation_url: `${COURIER_PORTAL_URL}/activate?token=${courier.activation_token}`,
  })
}
