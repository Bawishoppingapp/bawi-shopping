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
      <aside className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-neutral-700">
        <div>
          <h3 className="font-semibold text-neutral-950">Photos that generate the best model preview</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Upload a sharp, high-resolution front photo showing the entire garment.</li>
            <li>Lay or hang it flat against a plain, contrasting background.</li>
            <li>Use bright, even daylight; avoid shadows, filters, glare, and screenshots.</li>
            <li>Add clear back, side, fabric-texture, label, and special-detail photos.</li>
            <li>Photograph every color separately. Keep people, hands, packaging, and unrelated objects out of frame.</li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-neutral-950">Details you must describe accurately</h3>
          <p className="mt-2">Item type, exact color, material, pattern, fit, length, sleeve and neckline style, closures, pockets, lining, stretch, included pieces, available variants, measurements, care instructions, condition, and logo or decoration placement.</p>
        </div>
        <p className="font-medium text-red-700">AI previews are checked against the original photos. Cropped, blurry, filtered, inaccurate, or incomplete submissions may be rejected.</p>
      </aside>
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
        Upload clear product photos
      </Button>
    </form>
  )
}
