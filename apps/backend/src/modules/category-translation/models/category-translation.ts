import { model } from "@medusajs/framework/utils"

export const CategoryTranslation = model.define("category_translation", {
  id: model.id().primaryKey(),
  // Plain reference to Medusa's native product_category.id - same loose-
  // coupling reasoning as product_listing.product_id (see docs/DECISIONS.md).
  category_id: model.text(),
  locale: model.enum(["am", "ti", "om", "zh-CN", "es"]),
  name: model.text(),
})
