import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Every conditional block below is config-only and additive: with none of
// these env vars set, behavior is byte-for-byte identical to before this
// change (in-memory event bus/cache/locking/workflow-engine, local-disk
// file storage, notification-local only) - see docs/DEPLOYMENT.md §9 and
// §8. None of this enables live payments, live transfers, live email,
// live SMS, or any other real-operation feature flag; those remain gated
// separately by business-config (see docs/DEPLOYMENT.md §4.3).
const redisUrl = process.env.REDIS_URL

// Managed Postgres providers outside AWS (Supabase, Heroku, etc.) require
// TLS but present a certificate chain Node's default strict verification
// rejects for a generic client ("self-signed certificate in certificate
// chain") - confirmed against a real failed deploy, see
// docs/DEPLOYMENT-LOWCOST.md §2. A `?sslmode=...` query param on
// DATABASE_URL alone does NOT fix this: Medusa's own connection loader
// (@medusajs/utils's createPgConnection, confirmed against its actual
// source) always passes an explicit `ssl` option to the driver that
// overrides anything parsed from the connection string, defaulting to
// `ssl: false` unless set here via databaseDriverOptions. Off by default
// - AWS RDS (via infra/terraform) and local/CI Postgres need no change.
const databasePoolMax = Number(process.env.DATABASE_POOL_MAX)
const hasDatabasePoolMax =
  Number.isInteger(databasePoolMax) && databasePoolMax > 0
const useRelaxedDatabaseTls =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "false"

const databaseDriverOptions =
  useRelaxedDatabaseTls || hasDatabasePoolMax
    ? {
        ...(useRelaxedDatabaseTls
          ? { connection: { ssl: { rejectUnauthorized: false } } }
          : {}),
        ...(hasDatabasePoolMax
          ? { pool: { min: 0, max: databasePoolMax } }
          : {}),
      }
    : undefined

// "@medusajs/medusa/cache-redis" etc. are Medusa's own re-exports of the
// underlying @medusajs/cache-redis/@medusajs/event-bus-redis/... packages
// (see apps/backend/package.json) - the same resolution pattern already
// used below for "@medusajs/medusa/notification". Required the moment
// more than one backend instance runs (see docs/DEPLOYMENT.md §9): the
// default in-memory implementations do not coordinate across processes.
const redisInfraModules = redisUrl
  ? [
      { resolve: "@medusajs/medusa/cache-redis", options: { redisUrl } },
      { resolve: "@medusajs/medusa/event-bus-redis", options: { redisUrl } },
      { resolve: "@medusajs/medusa/locking-redis", options: { redisUrl } },
      { resolve: "@medusajs/medusa/workflow-engine-redis", options: { redisUrl } },
    ]
  : []

// Config-only swap from the default local-disk file provider to S3 (or
// any S3-compatible provider - MinIO, DigitalOcean Spaces, etc. via
// S3_ENDPOINT) - see docs/DEPLOYMENT.md §8. Only active once S3_BUCKET is
// set; otherwise Medusa's own default (local disk) module keeps handling
// uploads unchanged.
//
// Two authentication modes, matching @medusajs/file-s3's own
// `authentication_method: "access-key" | "s3-iam-role"` option (confirmed
// against its source, node_modules/@medusajs/file-s3/dist/services/
// s3-file.js - not guessed):
//   - S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY set: "access-key" mode, for a
//     non-AWS S3-compatible provider that has no concept of an IAM role.
//   - Neither set: "s3-iam-role" mode - the AWS SDK's default credential
//     chain resolves the running ECS task's IAM role automatically (see
//     infra/terraform/iam.tf's aws_iam_role.ecs_task), so a real AWS
//     deployment needs zero S3 credentials of any kind.
const s3FileModule = process.env.S3_BUCKET
  ? [
      {
        resolve: "@medusajs/medusa/file",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/file-s3",
              id: "s3",
              options: {
                file_url: process.env.S3_FILE_URL,
                region: process.env.S3_REGION,
                bucket: process.env.S3_BUCKET,
                endpoint: process.env.S3_ENDPOINT,
                ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
                  ? {
                      authentication_method: "access-key",
                      access_key_id: process.env.S3_ACCESS_KEY_ID,
                      secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                    }
                  : { authentication_method: "s3-iam-role" }),
              },
            },
          ],
        },
      },
    ]
  : []

// Config-only additional notification provider, off unless explicitly
// selected - real_email_enabled (business-config) still gates whether
// any code path treats email as actually delivered; this only makes a
// real provider available to select once that decision is made (see
// docs/DEPLOYMENT.md §8).
const emailProviders = [
  {
    resolve: "@medusajs/notification-local",
    id: "local",
    options: { channels: ["email-local"] },
  },
  ...(process.env.EMAIL_PROVIDER === "sendgrid"
    ? [
        {
          resolve: "@medusajs/medusa/notification-sendgrid",
          id: "sendgrid",
          options: {
            channels: ["email"],
            api_key: process.env.SENDGRID_API_KEY,
            from: process.env.SENDGRID_FROM_EMAIL,
          },
        },
      ]
    : []),
  ...(process.env.EMAIL_PROVIDER === "brevo"
    ? [
        {
          resolve: "./src/providers/brevo-notification",
          id: "brevo",
          options: {
            channels: ["email"],
            api_key: process.env.BREVO_API_KEY,
            from: process.env.BREVO_FROM_EMAIL ?? "support@bawishopping.com",
            from_name: process.env.BREVO_FROM_NAME ?? "Bawi Shopping",
          },
        },
      ]
    : []),
  ...(process.env.EMAIL_PROVIDER === "resend"
    ? [
        {
          resolve: "./src/providers/resend-notification",
          id: "resend",
          options: {
            channels: ["email"],
            api_key: process.env.RESEND_API_KEY,
            from: process.env.RESEND_FROM_EMAIL ?? "support@bawishopping.com",
            from_name: process.env.RESEND_FROM_NAME ?? "Bawi Shopping",
          },
        },
      ]
    : []),
]

module.exports = defineConfig({
  admin: { ...(process.env.DISABLE_MEDUSA_ADMIN_UI === "true" ? { disable: true } : {}) },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    ...(databaseDriverOptions ? { databaseDriverOptions } : {}),
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
      resolve: "./src/modules/wishlist",
    },
    {
      resolve: "./src/modules/device-push-token",
    },
    {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: emailProviders,
      },
    },
    ...s3FileModule,
    ...redisInfraModules,
  ],
})
