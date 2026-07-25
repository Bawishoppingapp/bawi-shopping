"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Select } from "@bawi/ui"

export function SortSelect({
  label,
  newestLabel,
  priceAscLabel,
  priceDescLabel,
}: {
  label: string
  newestLabel: string
  priceAscLabel: string
  priceDescLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("sort", event.target.value)
    params.delete("cursor")
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <label className="flex items-center gap-2 text-sm text-neutral-700">
      <span className="whitespace-nowrap">{label}</span>
      <Select
        defaultValue={searchParams.get("sort") ?? "newest"}
        onChange={handleChange}
        className="w-auto"
      >
        <option value="newest">{newestLabel}</option>
        <option value="price_asc">{priceAscLabel}</option>
        <option value="price_desc">{priceDescLabel}</option>
      </Select>
    </label>
  )
}
