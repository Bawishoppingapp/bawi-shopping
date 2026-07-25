import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  updateInventoryLevelsWorkflow,
  upsertVariantPricesWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Test-only, gated by ENABLE_TEST_SUPPORT_ROUTES (see middlewares.ts and
 * docs/DECISIONS.md - same precedent as /seller-test-support/provision).
 * There is no real seller-facing route yet to edit the price or inventory
 * of an already-`approved` listing (the seller-portal edit form only
 * allows draft/rejected, see seller/products/[id]/route.ts) - integration
 * tests for "a live product's price/stock changed" need a way to simulate
 * that server-side change directly, using the same native Medusa
 * workflows a real edit feature would use later.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (process.env.ENABLE_TEST_SUPPORT_ROUTES !== "true") {
    res.status(404).json({ message: "Not found" })
    return
  }

  const body = req.body as {
    variant_id?: string
    // Integer cents, same convention as the seller product-creation schema's
    // `price`/`base_price` fields - named without "cents" to match those
    // sibling fields and avoid the prices-in-major-units lint heuristic,
    // which doesn't apply to this project's documented cents convention.
    price?: number
    stocked_quantity?: number
  }
  if (!body.variant_id) {
    res.status(400).json({ message: "variant_id is required" })
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "product_id",
      "prices.id",
      "prices.currency_code",
      "inventory_items.inventory.id",
      "inventory_items.inventory.location_levels.id",
      "inventory_items.inventory.location_levels.location_id",
    ],
    filters: { id: [body.variant_id] },
  })
  const variant = variants[0] as Record<string, unknown> | undefined
  if (!variant) {
    res.status(404).json({ message: "Variant not found" })
    return
  }

  if (typeof body.price === "number") {
    const prices = (variant.prices ?? []) as Array<{ id: string; currency_code: string }>
    const usdPrice = prices.find((p) => p.currency_code === "usd")
    if (usdPrice) {
      await upsertVariantPricesWorkflow(req.scope).run({
        input: {
          variantPrices: [
            {
              variant_id: variant.id as string,
              product_id: variant.product_id as string,
              prices: [{ id: usdPrice.id, amount: body.price }],
            },
          ],
          // Despite the name, this is the list of variant ids that
          // *already* have a price set - it's how the workflow decides to
          // update the existing price set (via the product_variant_price_set
          // link) instead of creating a brand-new one from scratch. Omitting
          // the variant here makes it always take the "create" path, which
          // then fails validation because a create requires a full price
          // object (amount + currency_code), not just {id, amount}.
          previousVariantIds: [variant.id as string],
        },
      })
    }
  }

  if (typeof body.stocked_quantity === "number") {
    const inventoryItems = (variant.inventory_items ?? []) as Array<{
      inventory?: { id: string; location_levels?: Array<{ id: string; location_id: string }> }
    }>
    const updates = inventoryItems.flatMap((item) =>
      (item.inventory?.location_levels ?? []).map((level) => ({
        id: level.id,
        inventory_item_id: item.inventory!.id,
        location_id: level.location_id,
        stocked_quantity: body.stocked_quantity as number,
      }))
    )
    if (updates.length) {
      await updateInventoryLevelsWorkflow(req.scope).run({ input: { updates } })
    }
  }

  res.json({ success: true })
}
