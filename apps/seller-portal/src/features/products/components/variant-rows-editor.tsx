"use client"

import { useState } from "react"
import { Button, Input } from "@bawi/ui"
import { EMPTY_VARIANT_ROW, type VariantRow } from "../constants"

/**
 * Manages the color/size/price/inventory rows locally, then serializes
 * them into a single hidden field on submit - the Server Action parses
 * that JSON rather than trying to reconstruct a dynamic array from plain
 * FormData indices.
 */
export function VariantRowsEditor({
  initialVariants,
  error,
}: {
  initialVariants?: VariantRow[]
  error?: string
}) {
  const [rows, setRows] = useState<VariantRow[]>(
    initialVariants && initialVariants.length > 0
      ? initialVariants
      : [{ ...EMPTY_VARIANT_ROW }]
  )

  function updateRow(index: number, field: keyof VariantRow, value: string) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  function addRow() {
    setRows((current) => [...current, { ...EMPTY_VARIANT_ROW }])
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, i) => i !== index))
  }

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-neutral-900">
        Colors, sizes &amp; inventory
      </legend>

      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            Color
            <Input
              value={row.color}
              onChange={(e) => updateRow(index, "color", e.target.value)}
              placeholder="Blue"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            Size
            <Input
              value={row.size}
              onChange={(e) => updateRow(index, "size", e.target.value)}
              placeholder="M"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            Price override (cents)
            <Input
              value={row.price}
              onChange={(e) => updateRow(index, "price", e.target.value)}
              placeholder="optional"
              inputMode="numeric"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-neutral-600">
            Inventory qty
            <Input
              value={row.inventory_quantity}
              onChange={(e) => updateRow(index, "inventory_quantity", e.target.value)}
              inputMode="numeric"
            />
          </label>
          <Button
            type="button"
            variant="secondary"
            onClick={() => removeRow(index)}
            disabled={rows.length === 1}
          >
            Remove
          </Button>
        </div>
      ))}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <Button type="button" variant="secondary" onClick={addRow} className="self-start">
        Add variant
      </Button>

      <input type="hidden" name="variants_json" value={JSON.stringify(rows)} />
    </fieldset>
  )
}
