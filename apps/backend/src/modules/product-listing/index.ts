import { Module } from "@medusajs/framework/utils"
import ProductListingModuleService from "./service"

export const PRODUCT_LISTING_MODULE = "product_listing"

export default Module(PRODUCT_LISTING_MODULE, {
  service: ProductListingModuleService,
})
