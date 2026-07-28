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
      matcher: "/admin/couriers*",
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/fulfillment-orders*",
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/finance*",
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
    {
      // Own actor type, scoped strictly to its one assigned delivery at a
      // time (see docs/USER-ROLES.md §2.7) - not the seller_user or user
      // actor type. /courier-activation/complete is deliberately NOT
      // matched here (same public-but-token-gated pattern as
      // /seller-activation/complete).
      matcher: "/courier/*",
      middlewares: [authenticate("courier", ["bearer", "session"])],
    },
    {
      // Optional auth: a valid customer bearer token identifies an
      // authenticated customer's cart, but guests (no token) are not
      // rejected - they're identified by the opaque x-cart-id header
      // instead (see src/cart/cart-session.ts).
      matcher: "/store/cart*",
      middlewares: [
        authenticate("customer", ["bearer", "session"], { allowUnauthenticated: true }),
      ],
    },
    {
      matcher: "/store/cart/merge",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      // No guest checkout in v1 - order.customer_id is NOT NULL by design
      // (see docs/DATABASE.md), so a customer must be authenticated before
      // starting checkout or reading their own order history.
      matcher: "/store/checkout*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/orders*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/vendor-orders*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/return-requests*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/notifications*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
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
