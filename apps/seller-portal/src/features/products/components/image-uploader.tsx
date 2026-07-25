"use client"

import { useActionState } from "react"
import { Button, Checkbox } from "@bawi/ui"
import { uploadImagesAction } from "../actions/upload-images"
import { initialImageUploadState } from "../constants"

export function ImageUploader({ listingId }: { listingId: string }) {
  const [state, formAction, pending] = useActionState(
    uploadImagesAction.bind(null, listingId),
    initialImageUploadState
  )

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-neutral-600">
        Add images (JPEG, PNG, or WebP, up to 5MB each)
        <input
          type="file"
          name="files"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="text-sm"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <Checkbox name="is_primary" />
        Set the first uploaded image as the primary photo
      </label>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-sm text-green-700">
          Images uploaded.
        </p>
      )}

      <Button type="submit" variant="secondary" loading={pending} className="self-start">
        Upload
      </Button>
    </form>
  )
}
