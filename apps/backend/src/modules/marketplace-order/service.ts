import { MedusaService } from "@medusajs/framework/utils"
import { MarketplaceOrder } from "./models/order"
import { VendorOrder } from "./models/vendor-order"
import { VendorOrderItem } from "./models/vendor-order-item"

// Vendor scoping note: vendor_order/vendor_order_item queries from a
// seller-authenticated caller must always filter by the vendor_id derived
// from req.auth_context (see src/api/seller/me/route.ts) - never a client-
// supplied id - same convention as the seller module.
class OrderModuleService extends MedusaService({
  MarketplaceOrder,
  VendorOrder,
  VendorOrderItem,
}) {}

export default OrderModuleService
