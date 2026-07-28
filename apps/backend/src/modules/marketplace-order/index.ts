import { Module } from "@medusajs/framework/utils"
import OrderModuleService from "./service"

// Not "order" - that key/table name is reserved by Medusa's own native
// commerce module even though this project builds its own order concept
// instead of using it (see docs/DECISIONS.md).
export const MARKETPLACE_ORDER_MODULE = "marketplace_order"

export default Module(MARKETPLACE_ORDER_MODULE, {
  service: OrderModuleService,
})
