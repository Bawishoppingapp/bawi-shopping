"use client"

import { useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button, Checkbox, FormField, Input, Select } from "@bawi/ui"
import type { BrandOption, CategoryNode } from "../services/discovery-client"

export interface FilterControlsLabels {
  title: string
  category: string
  allCategories: string
  all: string
  brand: string
  size: string
  color: string
  price: string
  priceMin: string
  priceMax: string
  availability: string
  inStockOnly: string
  apply: string
  clear: string
  close: string
}

export function FilterControls({
  categories,
  brands,
  sizes,
  colors,
  labels,
}: {
  categories: { category: CategoryNode; depth: number }[]
  brands: BrandOption[]
  sizes: string[]
  colors: string[]
  labels: FilterControlsLabels
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [mobileOpen, setMobileOpen] = useState(false)

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams(searchParams.toString())
    const fields = ["category", "brand", "size", "color", "price_min", "price_max"] as const
    for (const field of fields) {
      const value = formData.get(field)
      if (typeof value === "string" && value.trim()) {
        params.set(field, value.trim())
      } else {
        params.delete(field)
      }
    }
    if (formData.get("available") === "on") {
      params.set("available", "true")
    } else {
      params.delete("available")
    }
    params.delete("cursor")
    router.push(`${pathname}?${params.toString()}`)
    setMobileOpen(false)
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString())
    for (const field of ["category", "brand", "size", "color", "price_min", "price_max", "available", "cursor"]) {
      params.delete(field)
    }
    router.push(`${pathname}?${params.toString()}`)
    setMobileOpen(false)
  }

  const formContent = (
    <form
      action={applyFilters}
      className="flex flex-col gap-4"
      data-testid="filter-form"
    >
      <FormField label={labels.category}>
        <Select name="category" defaultValue={searchParams.get("category") ?? ""}>
          <option value="">{labels.allCategories}</option>
          {categories.map(({ category, depth }) => (
            <option key={category.id} value={category.id}>
              {"  ".repeat(depth)}
              {category.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={labels.brand}>
        <Select name="brand" defaultValue={searchParams.get("brand") ?? ""}>
          <option value="">{labels.all}</option>
          {brands.map((brand) => (
            <option key={brand.slug} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </Select>
      </FormField>

      {sizes.length > 0 && (
        <FormField label={labels.size}>
          <Select name="size" defaultValue={searchParams.get("size") ?? ""}>
            <option value="">{labels.all}</option>
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {colors.length > 0 && (
        <FormField label={labels.color}>
          <Select name="color" defaultValue={searchParams.get("color") ?? ""}>
            <option value="">{labels.all}</option>
            {colors.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-neutral-900">{labels.price}</legend>
        <div className="flex items-center gap-2">
          <FormField label={labels.priceMin}>
            <Input type="number" name="price_min" min={0} defaultValue={searchParams.get("price_min") ?? ""} />
          </FormField>
          <span className="mt-5 text-neutral-400">–</span>
          <FormField label={labels.priceMax}>
            <Input type="number" name="price_max" min={0} defaultValue={searchParams.get("price_max") ?? ""} />
          </FormField>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm font-medium text-neutral-900">{labels.availability}</legend>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <Checkbox name="available" defaultChecked={searchParams.get("available") === "true"} />
          {labels.inStockOnly}
        </label>
      </fieldset>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" className="flex-1">
          {labels.apply}
        </Button>
        <Button type="button" variant="secondary" onClick={clearFilters}>
          {labels.clear}
        </Button>
      </div>
    </form>
  )

  return (
    <>
      <div className="hidden lg:block lg:w-64 lg:shrink-0">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">{labels.title}</h2>
        {formContent}
      </div>

      <div className="lg:hidden">
        <Button type="button" variant="secondary" onClick={() => setMobileOpen(true)}>
          {labels.title}
        </Button>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div
              data-testid="mobile-filter-drawer"
              className="relative ml-auto flex h-full w-full max-w-xs flex-col overflow-y-auto bg-white p-4 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-neutral-900">{labels.title}</h2>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label={labels.close}
                  className="text-neutral-500"
                >
                  ✕
                </button>
              </div>
              {formContent}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
