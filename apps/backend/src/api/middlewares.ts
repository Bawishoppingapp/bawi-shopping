import { defineMiddlewares, authenticate } from "@medusajs/framework/http"
import multer from "multer"
import { rateLimit } from "../rate-limiting/rate-limiter"

const upload = multer({ storage: multer.memoryStorage() })

export default defineMiddlewares({
  routes: [
    {
      // Every login/register/reset-password endpoint across every actor
      // type (customer, seller_user, user, courier) - credential
      // stuffing / registration-spam protection. See docs/SECURITY.md's
      // pre-launch hardening section.
      method: ["POST"],
      matcher: "/auth/*",
      middlewares: [
        rateLimit({
          windowMs: 5 * 60 * 1000,
          max: 20,
          message: "Too many authentication attempts. Please wait a few minutes and try again.",
        }),
      ],
    },
    {
      // Public, unauthenticated write endpoint - documented gap in
      // docs/IMPLEMENTATION-PLAN.md ("no rate-limiting or CAPTCHA yet").
      method: ["POST"],
      matcher: "/seller-applications",
      middlewares: [
        rateLimit({
          windowMs: 60 * 60 * 1000,
          max: 5,
          message: "Too many applications submitted from this address. Please try again later.",
        }),
      ],
    },
    {
      // Token-exchange endpoint, public by design (the token itself is
      // the credential) - rate-limited against brute-forcing the
      // activation token.
      method: ["POST"],
      matcher: "/seller-activation/complete",
      middlewares: [
        rateLimit({
          windowMs: 60 * 60 * 1000,
          max: 10,
          message: "Too many attempts. Please try again later.",
        }),
      ],
    },
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
      matcher: "/admin/product-translations*",
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
      matcher: "/store/wishlist*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/push-tokens*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      method: ["DELETE"],
      matcher: "/store/customers/me",
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
