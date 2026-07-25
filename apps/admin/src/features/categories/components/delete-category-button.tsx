"use client"

import { useActionState } from "react"
import { Button } from "@bawi/ui"
import { deleteCategoryAction } from "../actions/delete"
import { initialCategoryFormState } from "../constants"

export function DeleteCategoryButton({ categoryId }: { categoryId: string }) {
  const [state, formAction, pending] = useActionState(
    deleteCategoryAction.bind(null, categoryId),
    initialCategoryFormState
  )

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <Button type="submit" variant="destructive" loading={pending}>
        Delete category
      </Button>
      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
    </form>
  )
}
