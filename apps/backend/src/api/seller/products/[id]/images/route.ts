import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { resolveVendorId } from "../../../utils"
import { PRODUCT_LISTING_MODULE } from "../../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../../modules/product-listing/service"

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Uploads one or more product images via Medusa's native file module (local
 * provider in dev, S3 provider in production - see docs/DECISIONS.md) and
 * appends them to the product's image gallery. `is_primary=true` sets the
 * uploaded image as the product's thumbnail. File type/size are validated
 * server-side against the actual buffer, not the client-supplied filename.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const productListingModuleService: ProductListingModuleService = req.scope.resolve(
    PRODUCT_LISTING_MODULE
  )
  const [listing] = await productListingModuleService.listProductListings({
    id: req.params.id,
    vendor_id: vendorId,
  })
  if (!listing) {
    res.status(404).json({ message: "Product not found" })
    return
  }

  const files = req.files as Express.Multer.File[] | undefined
  if (!files?.length) {
    res.status(400).json({ message: "No files were uploaded" })
    return
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      res.status(400).json({
        message: `Unsupported file type: ${file.mimetype}. Allowed: JPEG, PNG, WebP.`,
      })
      return
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      res.status(400).json({ message: "Each image must be 5MB or smaller." })
      return
    }
  }

  const { result: uploadedFiles } = await uploadFilesWorkflow(req.scope).run({
    input: {
      files: files.map((file) => ({
        filename: file.originalname,
        mimeType: file.mimetype,
        content: file.buffer.toString("base64"),
        access: "public" as const,
      })),
    },
  })

  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const product = await productModuleService.retrieveProduct(listing.product_id, {
    relations: ["images"],
  })

  const isPrimary = req.body && (req.body as Record<string, unknown>).is_primary === "true"
  const existingUrls = product.images?.map((image) => ({ url: image.url })) ?? []
  const newUrls = uploadedFiles.map((file) => ({ url: file.url }))

  const updated = await productModuleService.updateProducts(listing.product_id, {
    images: [...existingUrls, ...newUrls],
    ...(isPrimary && newUrls[0] ? { thumbnail: newUrls[0].url } : {}),
  })

  res.status(201).json({ product: updated })
}
