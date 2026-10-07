import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"

const SIZE_VALUES = ["S", "M", "L", "XL"]
const PRICES = [
  { amount: 10, currency_code: "eur" },
  { amount: 15, currency_code: "usd" },
]

type SeedProduct = {
  title: string
  handle: string
  category: string
  description: string
  images: string[]
  colors?: string[]
  skuPrefix: string
}

const SEED_PRODUCTS: SeedProduct[] = [
  {
    title: "Medusa T-Shirt",
    handle: "t-shirt",
    category: "Shirts",
    description:
      "Reimagine the feeling of a classic T-shirt. With our cotton T-shirts, everyday essentials no longer have to be ordinary.",
    images: [
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-back.png",
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-white-front.png",
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-white-back.png",
    ],
    colors: ["Black", "White"],
    skuPrefix: "SHIRT",
  },
  {
    title: "Medusa Sweatshirt",
    handle: "sweatshirt",
    category: "Sweatshirts",
    description:
      "Reimagine the feeling of a classic sweatshirt. With our cotton sweatshirt, everyday essentials no longer have to be ordinary.",
    images: [
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-back.png",
    ],
    skuPrefix: "SWEATSHIRT",
  },
  {
    title: "Medusa Sweatpants",
    handle: "sweatpants",
    category: "Pants",
    description:
      "Reimagine the feeling of classic sweatpants. With our cotton sweatpants, everyday essentials no longer have to be ordinary.",
    images: [
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-front.png",
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatpants-gray-back.png",
    ],
    skuPrefix: "SWEATPANTS",
  },
  {
    title: "Medusa Shorts",
    handle: "shorts",
    category: "Bottoms",
    description:
      "Reimagine the feeling of classic shorts. With our cotton shorts, everyday essentials no longer have to be ordinary.",
    images: [
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-front.png",
      "https://medusa-public-images.s3.eu-west-1.amazonaws.com/shorts-vintage-back.png",
    ],
    skuPrefix: "SHORTS",
  },
]

function variantsFor(product: SeedProduct) {
  if (product.colors) {
    return SIZE_VALUES.flatMap((size) =>
      product.colors!.map((color) => ({
        title: `${size} / ${color}`,
        sku: `${product.skuPrefix}-${size}-${color.toUpperCase()}`,
        manage_inventory: true,
        options: { Size: size, Color: color },
        prices: PRICES,
      }))
    )
  }

  return SIZE_VALUES.map((size) => ({
    title: size,
    sku: `${product.skuPrefix}-${size}`,
    manage_inventory: true,
    options: { Size: size },
    prices: PRICES,
  }))
}

/**
 * Repairs both historical failure modes of the scaffold seed:
 * - existing Shorts rows that still point at the removed Merch category;
 * - a partially seeded database where the missing Merch lookup aborted the
 *   single create-products workflow before any of the four products existed.
 *
 * Every lookup uses a stable natural key and every create is restricted to a
 * missing handle, so this is safe to run after every staging migration.
 */
export async function repairInitialProducts(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const productService = container.resolve(Modules.PRODUCT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)

  const expectedCategoryNames = SEED_PRODUCTS.map((product) => product.category)
  const categories = await productService.listProductCategories(
    { name: [...expectedCategoryNames, "Merch"] },
    { select: ["id", "name"] }
  )
  const categoryByName = new Map(categories.map((category) => [category.name, category.id]))
  const missingCategories = expectedCategoryNames.filter((name) => !categoryByName.has(name))
  if (missingCategories.length) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Cannot repair initial products; missing categories: ${missingCategories.join(", ")}`
    )
  }

  const [salesChannel] = await salesChannelService.listSalesChannels({
    name: "Default Sales Channel",
  })
  const { data: shippingProfiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id"],
  })
  const [preferredStockLocation] = await stockLocationService.listStockLocations({
    name: "European Warehouse",
  })
  const stockLocations = preferredStockLocation
    ? [preferredStockLocation]
    : await stockLocationService.listStockLocations({})
  const shippingProfile = shippingProfiles[0]
  const stockLocation = stockLocations[0]

  if (!salesChannel || !shippingProfile || !stockLocation) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Cannot repair initial products; the default sales channel, shipping profile, or stock location is missing"
    )
  }

  const existingProducts = await productService.listProducts(
    { handle: SEED_PRODUCTS.map((product) => product.handle) },
    { select: ["id", "handle"], relations: ["categories"] }
  )
  const existingByHandle = new Map(existingProducts.map((product) => [product.handle, product]))

  const existingShorts = existingByHandle.get("shorts")
  const legacyMerchCategoryId = categoryByName.get("Merch")
  const bottomsCategoryId = categoryByName.get("Bottoms")!
  const existingShortsCategoryIds = existingShorts?.categories?.map((category) => category.id) ?? []
  const needsLegacyShortsRepair = Boolean(
    existingShorts &&
      legacyMerchCategoryId &&
      existingShortsCategoryIds.includes(legacyMerchCategoryId)
  )
  const repairedShortsCategoryIds = needsLegacyShortsRepair
    ? Array.from(
        new Set([
          ...existingShortsCategoryIds.filter((id) => id !== legacyMerchCategoryId),
          bottomsCategoryId,
        ])
      )
    : []
  const existingUpdates = needsLegacyShortsRepair
    ? [
        {
          id: existingShorts!.id,
          categories: repairedShortsCategoryIds.map((id) => ({ id })),
        },
      ]
    : []
  if (existingUpdates.length) {
    await updateProductsWorkflow(container).run({
      input: { products: existingUpdates },
    })
  }

  const missingProducts = SEED_PRODUCTS.filter(
    (product) => !existingByHandle.has(product.handle)
  )
  if (missingProducts.length) {
    await createProductsWorkflow(container).run({
      input: {
        products: missingProducts.map((product) => ({
          title: product.title,
          handle: product.handle,
          description: product.description,
          weight: 400,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          categories: [{ id: categoryByName.get(product.category)! }],
          images: product.images.map((url) => ({ url })),
          options: [
            { title: "Size", values: SIZE_VALUES },
            ...(product.colors
              ? [{ title: "Color", values: product.colors }]
              : []),
          ],
          variants: variantsFor(product),
          sales_channels: [{ id: salesChannel.id }],
        })),
      },
    })
  }

  const repairedProducts = await productService.listProducts(
    { handle: SEED_PRODUCTS.map((product) => product.handle) },
    { select: ["id", "handle"] }
  )
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "inventory_items.inventory.id",
      "inventory_items.inventory.location_levels.location_id",
    ],
    filters: { product_id: repairedProducts.map((product) => product.id) },
  })

  const missingInventoryLevels = (variants as Record<string, unknown>[]).flatMap((variant) => {
    const inventoryItems = (variant.inventory_items ?? []) as Array<{
      inventory?: { id?: string; location_levels?: Array<{ location_id?: string }> }
    }>
    return inventoryItems.flatMap((item) => {
      const inventoryId = item.inventory?.id
      const alreadyStocked = item.inventory?.location_levels?.some(
        (level) => level.location_id === stockLocation.id
      )
      return inventoryId && !alreadyStocked
        ? [
            {
              location_id: stockLocation.id,
              stocked_quantity: 1_000_000,
              inventory_item_id: inventoryId,
            },
          ]
        : []
    })
  })

  if (missingInventoryLevels.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: { inventory_levels: missingInventoryLevels },
    })
  }

  logger.info(
    `Initial product repair complete: ${missingProducts.length} created, ${existingUpdates.length} reconciled`
  )
}

export default async function repairInitialProductsScript({ container }: ExecArgs) {
  await repairInitialProducts(container)
}
