import { defineConfig } from "@playwright/test"

/**
 * Assumes the Medusa backend (apps/backend) is already running and
 * reachable at MEDUSA_BACKEND_URL / this app's .env.local - E2E exercises
 * the real registration flow end to end, no mocked backend.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
})
