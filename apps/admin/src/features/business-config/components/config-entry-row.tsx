"use client"

import { useActionState } from "react"
import { Button, Checkbox, Input, Textarea } from "@bawi/ui"
import { updateConfigEntryAction } from "../actions/update-entry"
import { initialConfigEntryFormState } from "../constants"
import type { ConfigEntry } from "../services/business-config-client"

export function ConfigEntryRow({ entry }: { entry: ConfigEntry }) {
  const [state, formAction, pending] = useActionState(
    updateConfigEntryAction.bind(null, entry.category, entry.key, entry.value_type),
    initialConfigEntryFormState
  )

  return (
    <form
      action={formAction}
      className={
        "flex flex-col gap-2 rounded-md border p-4 " +
        (entry.is_sensitive ? "border-amber-300 bg-amber-50" : "border-neutral-200")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-neutral-900">{entry.label}</p>
          {entry.description && (
            <p className="text-xs text-neutral-500">{entry.description}</p>
          )}
        </div>
        <div className="flex gap-1">
          {entry.is_placeholder && (
            <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              Placeholder
            </span>
          )}
          {entry.is_sensitive && (
            <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
              High-risk
            </span>
          )}
        </div>
      </div>

      {entry.value_type === "boolean" ? (
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <Checkbox name="value" defaultChecked={entry.value === true} />
          Enabled
        </label>
      ) : entry.value_type === "integer" ? (
        <Input type="number" name="value" defaultValue={String(entry.value ?? 0)} />
      ) : entry.value_type === "json" ? (
        <Textarea name="value" defaultValue={JSON.stringify(entry.value, null, 2)} rows={3} />
      ) : (
        <Input type="text" name="value" defaultValue={String(entry.value ?? "")} />
      )}

      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
      {state.status === "success" && (
        <p className="text-sm text-green-700">Saved.</p>
      )}

      <Button type="submit" variant="secondary" loading={pending} className="self-start">
        Save
      </Button>
    </form>
  )
}
