import { defineConfig } from "@playwright/test"

/**
 * Assumes the Medusa backend (apps/backend) is already running against the
 * same database this app's .env.local points at - the login spec seeds its
 * own seller via `medusa exec` before running, then exercises the real
 * login flow end to end.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
  },
  webServer: {
    command: "npm run dev -- -p 3001",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000,
  },
})
