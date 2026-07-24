import { defineConfig } from "@playwright/test"

/**
 * Assumes the Medusa backend (apps/backend) is already running against the
 * same database this app's .env.local points at.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3002",
  },
  webServer: {
    command: "npm run dev -- -p 3002",
    url: "http://localhost:3002",
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
})
