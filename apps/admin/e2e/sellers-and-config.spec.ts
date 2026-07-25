import { execFileSync } from "node:child_process"
import path from "node:path"
import { test, expect } from "@playwright/test"

const BACKEND_ROOT = path.resolve(__dirname, "../../backend")
const BACKEND_URL = "http://localhost:9000"

function createAdmin(email: string, password: string) {
  execFileSync("npx", ["medusa", "user", "-e", email, "-p", password], {
    cwd: BACKEND_ROOT,
    stdio: "pipe",
  })
}

async function provisionSeller(name: string, slug: string, email: string, password: string) {
  const response = await fetch(`${BACKEND_URL}/seller-test-support/provision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug, email, password }),
  })
  if (!response.ok) {
    throw new Error(`Could not provision seller: ${await response.text()}`)
  }
}

test.describe("Admin sellers visibility and business configuration", () => {
  const suffix = Date.now()
  const adminEmail = `e2e-config-admin-${suffix}@example.test`
  const adminPassword = "correct-horse-battery-admin"
  const sellerSlug = `e2e-config-seller-${suffix}`

  test.beforeAll(async () => {
    createAdmin(adminEmail, adminPassword)
    await provisionSeller(
      `E2E Config Seller ${suffix}`,
      sellerSlug,
      `${sellerSlug}@example.test`,
      "correct-horse-battery-s"
    )
  })

  async function login(page: import("@playwright/test").Page) {
    await page.goto("/login")
    await page.getByLabel("Email").fill(adminEmail)
    await page.getByLabel("Password").fill(adminPassword)
    await page.getByRole("button", { name: "Log in" }).click()
    await expect(page).toHaveURL(/\/applications$/)
  }

  test("sellers list shows the seeded seller as not connected to Stripe", async ({ page }) => {
    await login(page)
    await page.goto("/sellers")
    await expect(page.getByText(`E2E Config Seller ${suffix}`)).toBeVisible()
    // Scope to this seller's row so "Not connected" isn't ambiguous with
    // other sellers seeded by other specs in the same shared dev database.
    const row = page.getByRole("row", { name: new RegExp(sellerSlug) })
    await expect(row.getByText("Not connected")).toBeVisible()
  })

  test("business configuration page lists placeholder values and allows an admin edit", async ({
    page,
  }) => {
    await login(page)
    await page.goto("/config")

    await expect(page.getByText(/placeholder value.*pending real approval/i)).toBeVisible()

    const shippingSection = page
      .locator("form")
      .filter({ hasText: "Standard shipping fee (cents)" })
    await expect(shippingSection.getByText("Placeholder")).toBeVisible()

    await shippingSection.getByRole("spinbutton").fill("725")
    await shippingSection.getByRole("button", { name: "Save" }).click()
    await expect(shippingSection.getByText("Saved.")).toBeVisible()

    await page.reload()
    const reloadedSection = page
      .locator("form")
      .filter({ hasText: "Standard shipping fee (cents)" })
    await expect(reloadedSection.getByRole("spinbutton")).toHaveValue("725")
  })

  test("live_payments_enabled feature flag is visible, marked high-risk, and defaults off", async ({
    page,
  }) => {
    await login(page)
    await page.goto("/config")

    const flagSection = page.locator("form").filter({ hasText: "live_payments_enabled" })
    await expect(flagSection.getByText("High-risk")).toBeVisible()
    await expect(flagSection.getByRole("checkbox")).not.toBeChecked()
  })
})
