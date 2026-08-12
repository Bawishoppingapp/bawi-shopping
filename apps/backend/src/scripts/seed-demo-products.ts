import type { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { PRODUCT_LISTING_MODULE } from "../modules/product-listing"
import type ProductListingModuleService from "../modules/product-listing/service"
import { createProductDraftWorkflow } from "../workflows/create-product-draft"
import { approveProductListingWorkflow } from "../workflows/approve-product-listing"
import { getOrCreateDefaultStockLocationId } from "../workflows/shared/default-stock-location"

/**
 * Dev-only: creates a handful of real, approved, publicly-visible products
 * for the seller seeded by seed-seller.ts, using the exact same workflows
 * apps/seller-portal's product creation + apps/admin's approval actions
 * call - not a shortcut around the real product-listing lifecycle.
 *
 * Usage: npx medusa exec ./src/scripts/seed-demo-products.ts <seller-slug>
 */
export default async function seedDemoProducts({ container, args }: ExecArgs) {
  const [slug = "demo-seller"] = args

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
  const productListingModuleService: ProductListingModuleService = container.resolve(
    PRODUCT_LISTING_MODULE
  )
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const [seller] = await sellerModuleService.listSellers({ slug })
  if (!seller) {
    logger.error(`No seller with slug "${slug}" - run seed-seller.ts first.`)
    return
  }

  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name"],
  })
  const categoryByName = new Map(categories.map((c: any) => [c.name, c.id]))

  const stockLocationId = await getOrCreateDefaultStockLocationId(container)

  const products = [
    {
      title: "Classic Crewneck Tee",
      description: "A soft, everyday cotton tee with a relaxed fit.",
      category: "Shirts",
      productCode: "BAWI-TEE-001",
      basePrice: 2800,
      variants: [
        { color: "Black", size: "S", inventory_quantity: 25 },
        { color: "Black", size: "M", inventory_quantity: 25 },
        { color: "Black", size: "L", inventory_quantity: 25 },
        { color: "White", size: "S", inventory_quantity: 25 },
        { color: "White", size: "M", inventory_quantity: 25 },
      ],
    },
    {
      title: "Heavyweight Hoodie",
      description: "Brushed-fleece hoodie built for cooler days.",
      category: "Sweatshirts",
      productCode: "BAWI-HOOD-001",
      basePrice: 6500,
      variants: [
        { color: "Charcoal", size: "M", inventory_quantity: 15 },
        { color: "Charcoal", size: "L", inventory_quantity: 15 },
        { color: "Olive", size: "M", inventory_quantity: 15 },
      ],
    },
    {
      title: "Relaxed Fit Chinos",
      description: "Tapered chinos with a comfortable, relaxed cut.",
      category: "Pants",
      productCode: "BAWI-CHIN-001",
      basePrice: 5400,
      variants: [
        { color: "Khaki", size: "30", inventory_quantity: 10 },
        { color: "Khaki", size: "32", inventory_quantity: 10 },
        { color: "Navy", size: "32", inventory_quantity: 10 },
      ],
    },
  ]

  for (const p of products) {
    const categoryId = categoryByName.get(p.category)
    if (!categoryId) {
      logger.warn(`Skipping "${p.title}" - no category named "${p.category}"`)
      continue
    }

    const [existing] = await productListingModuleService.listProductListings({
      product_code: p.productCode,
    })
    if (existing) {
      logger.info(`"${p.title}" already exists (${p.productCode}), skipping.`)
      continue
    }

    const { result } = await createProductDraftWorkflow(container).run({
      input: {
        vendorId: seller.id,
        title: p.title,
        description: p.description,
        categoryId,
        basePrice: p.basePrice,
        variants: p.variants,
        stockLocationId,
        productCode: p.productCode,
      },
    })

    await approveProductListingWorkflow(container).run({
      input: {
        listingId: result.listing.id,
        productId: result.product.id,
        vendorId: seller.id,
        adminUserId: "dev-seed-script",
        previousStatus: "draft",
      },
    })

    logger.info(`Created and approved "${p.title}" (${p.productCode})`)
  }
}
