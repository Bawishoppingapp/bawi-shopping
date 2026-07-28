"use client"

import { useTransition } from "react"
import { Button } from "@bawi/ui"
import { deleteInviteAction } from "../actions/team-actions"

export function DeleteInviteButton({ inviteId }: { inviteId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      type="button"
      variant="secondary"
      loading={pending}
      onClick={() => startTransition(() => deleteInviteAction(inviteId))}
    >
      Revoke
    </Button>
  )
}
