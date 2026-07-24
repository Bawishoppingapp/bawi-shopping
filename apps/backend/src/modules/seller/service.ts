import { MedusaService } from "@medusajs/framework/utils"
import { Seller } from "./models/seller"
import { SellerUser } from "./models/seller-user"

// Vendor scoping note: every method below is inherited from MedusaService's
// generated CRUD (retrieveSeller, listSellers, retrieveSellerUser, ...).
// Callers must always pass the vendor/seller_user id derived from
// req.auth_context (see src/api/seller/me/route.ts) - never a client-
// supplied id - to keep sellers from reaching each other's records.
class SellerModuleService extends MedusaService({
  Seller,
  SellerUser,
}) {}

export default SellerModuleService
