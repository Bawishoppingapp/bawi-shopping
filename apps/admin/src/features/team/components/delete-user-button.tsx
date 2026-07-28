"use client"

import { useTransition } from "react"
import { Button } from "@bawi/ui"
import { deleteUserAction } from "../actions/team-actions"

export function DeleteUserButton({ userId }: { userId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      type="button"
      variant="destructive"
      loading={pending}
      onClick={() => startTransition(() => deleteUserAction(userId))}
    >
      Remove
    </Button>
  )
}
