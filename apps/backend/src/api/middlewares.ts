import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import multer from "multer"

const upload = multer({ storage: multer.memoryStorage() })

export default defineMiddlewares({
  routes: [
    {
      matcher: "/seller/*",
      middlewares: [authenticate("seller_user", ["bearer", "session"])],
    },
    {
      method: ["POST"],
      matcher: "/seller/products/:id/images",
      middlewares: [upload.array("files")],
    },
    {
      matcher: "/admin/seller-applications*",
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/product-listings*",
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/categories*",
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/business-config*",
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/sellers*",
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      method: ["POST"],
      matcher: "/webhooks/stripe",
      // Stripe signature verification needs the exact raw request body -
      // the default JSON body parser would re-serialize it and break
      // verification. See docs/PAYMENTS.md §7, docs/SECURITY.md §4.
      bodyParser: { preserveRawBody: true },
    },
  ],
})
