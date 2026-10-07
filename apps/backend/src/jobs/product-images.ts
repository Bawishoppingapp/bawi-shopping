import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { PRODUCT_LISTING_MODULE } from "../modules/product-listing"
import type ProductListingModuleService from "../modules/product-listing/service"
import { processImage } from "../product-images/service"

export default async function productImages(container: MedusaContainer) {
  const listings: ProductListingModuleService = container.resolve(PRODUCT_LISTING_MODULE)
  const jobs = await listings.listProductListings({ ai_image_pending: true }, { take: 20, order: { updated_at: "ASC" } })
  for (const job of jobs) {
    try { await processImage(container, job.id) }
    catch { container.resolve(ContainerRegistrationKeys.LOGGER).error(`Product image job could not be saved: ${job.id}`) }
  }
}
export const config = { name: "bawi-product-images", schedule: "* * * * *" }
