import { defineMiddlewares, authenticate } from "@medusajs/framework/http"

export default defineMiddlewares({
  routes: [
    {
      matcher: "/seller/*",
      middlewares: [authenticate("seller_user", ["bearer", "session"])],
    },
    {
      matcher: "/admin/seller-applications*",
      middlewares: [authenticate("user", ["bearer", "session"])],
    },
  ],
})
