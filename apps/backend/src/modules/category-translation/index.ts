import { Module } from "@medusajs/framework/utils"
import CategoryTranslationModuleService from "./service"

export const CATEGORY_TRANSLATION_MODULE = "category_translation"

export default Module(CATEGORY_TRANSLATION_MODULE, {
  service: CategoryTranslationModuleService,
})
