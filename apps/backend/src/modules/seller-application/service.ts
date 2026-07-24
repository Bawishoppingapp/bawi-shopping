import { MedusaService } from "@medusajs/framework/utils"
import { SellerApplication } from "./models/seller-application"

// This module owns applications only - never the approved Seller/SellerUser
// records (those live in the `seller` module). Keeping them separate means
// a rejected or pending application can never be mistaken for real vendor
// access - see docs/SECURITY.md and docs/DECISIONS.md.
class SellerApplicationModuleService extends MedusaService({
  SellerApplication,
}) {}

export default SellerApplicationModuleService
