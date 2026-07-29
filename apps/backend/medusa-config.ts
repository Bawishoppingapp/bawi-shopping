import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  modules: [
    {
      resolve: "./src/modules/seller",
    },
    {
      resolve: "./src/modules/seller-application",
    },
    {
      resolve: "./src/modules/audit-log",
    },
    {
      resolve: "./src/modules/product-listing",
    },
    {
      resolve: "./src/modules/category-translation",
    },
    {
      resolve: "./src/modules/business-config",
    },
    {
      resolve: "./src/modules/webhook-event",
    },
    {
      resolve: "./src/modules/cart-merge",
    },
    {
      resolve: "./src/modules/marketplace-order",
    },
    {
      resolve: "./src/modules/fulfillment-privacy",
    },
    {
      resolve: "./src/modules/seller-finance",
    },
    {
      resolve: "./src/modules/notification-inbox",
    },
    {
      resolve: "./src/modules/product-translation",
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          {
            resolve: "@medusajs/notification-local",
            id: "local",
            options: { channels: ["email"] },
          },
        ],
      },
    },
  ],
})
