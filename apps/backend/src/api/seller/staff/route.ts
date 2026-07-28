import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"
import { resolveVendorId } from "../../seller/utils"
import { inviteSellerStaffWorkflow } from "../../../workflows/invite-seller-staff"

const inviteStaffSchema = z.object({
  email: z.string().email(),
  role: z.enum(["catalog_manager", "order_fulfiller", "analyst"]),
})

/** Any staff member can see the roster; only the owner can invite. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const staff = await sellerModuleService.listSellerUsers(
    { seller_id: vendorId },
    { order: { created_at: "ASC" } }
  )

  res.json({
    staff: staff.map((member) => ({
      id: member.id,
      email: member.email,
      role: member.role,
      activated: Boolean(member.auth_identity_id),
    })),
  })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const invitingUser = await sellerModuleService.retrieveSellerUser(req.auth_context.actor_id)
  if (invitingUser.role !== "owner") {
    res.status(403).json({ message: "Only the seller owner can invite staff" })
    return
  }

  const parsed = inviteStaffSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" })
    return
  }

  const [existing] = await sellerModuleService.listSellerUsers({
    seller_id: vendorId,
    email: parsed.data.email,
  })
  if (existing) {
    res.status(422).json({ message: "This email is already part of your team" })
    return
  }

  const { result: sellerUser } = await inviteSellerStaffWorkflow(req.scope).run({
    input: {
      sellerId: vendorId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedByUserId: invitingUser.id,
    },
  })

  res.status(201).json({
    staff: { id: sellerUser.id, email: sellerUser.email, role: sellerUser.role, activated: false },
  })
}
