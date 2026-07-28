"use client"

import { useTransition } from "react"
import { Button } from "@bawi/ui"
import { removeStaffAction } from "../actions/staff-actions"

export function RemoveStaffButton({ staffId }: { staffId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="destructive"
      loading={pending}
      onClick={() => startTransition(() => removeStaffAction(staffId))}
    >
      Remove
    </Button>
  )
}
