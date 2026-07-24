import { Module } from "@medusajs/framework/utils"
import SellerApplicationModuleService from "./service"

export const SELLER_APPLICATION_MODULE = "seller_application"

export default Module(SELLER_APPLICATION_MODULE, {
  service: SellerApplicationModuleService,
})
