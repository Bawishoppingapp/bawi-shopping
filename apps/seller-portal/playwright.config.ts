import path from "node:path"
import { defineConfig } from "@playwright/test"

/**
 * Assumes the Medusa backend (apps/backend) is already running against the
 * same database this app's .env.local points at. The seller-application
 * journey spans this app (apply, activate, login) and apps/admin (review,
 * approve/reject); the product-creation journey additionally spans
 * apps/storefront (public product page), so this config starts both.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
  },
  webServer: [
    {
      command: "npm run dev -- -p 3001",
      url: "http://localhost:3001",
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
    {
      command: "npm run dev -- -p 3002",
      url: "http://localhost:3002",
      cwd: path.resolve(__dirname, "../admin"),
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
    {
      command: "npm run dev -- -p 3000",
      url: "http://localhost:3000",
      cwd: path.resolve(__dirname, "../storefront"),
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
  ],
})
