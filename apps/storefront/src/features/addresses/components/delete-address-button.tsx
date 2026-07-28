"use client"

import { useTransition } from "react"
import { Button } from "@bawi/ui"
import { deleteAddressAction } from "../actions/addresses-actions"

export function DeleteAddressButton({ addressId }: { addressId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="secondary"
      loading={pending}
      onClick={() => startTransition(() => deleteAddressAction(addressId))}
    >
      Remove
    </Button>
  )
}
