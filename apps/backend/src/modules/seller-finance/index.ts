import { Module } from "@medusajs/framework/utils"
import SellerFinanceModuleService from "./service"

export const SELLER_FINANCE_MODULE = "seller_finance"

export default Module(SELLER_FINANCE_MODULE, {
  service: SellerFinanceModuleService,
})
