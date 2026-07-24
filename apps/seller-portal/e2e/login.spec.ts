import { execFileSync } from "node:child_process"
import path from "node:path"
import { test, expect } from "@playwright/test"

const BACKEND_ROOT = path.resolve(__dirname, "../../backend")

function seedSeller(name: string, slug: string, email: string, password: string) {
  execFileSync(
    "npx",
    ["medusa", "exec", "./src/scripts/seed-seller.ts", name, slug, email, password],
    { cwd: BACKEND_ROOT, stdio: "pipe" }
  )
}

test.describe("Seller authentication", () => {
  const suffix = Date.now()
  const email = `e2e-owner-${suffix}@example.test`
  const password = "correct-horse-battery-e2e"
  const sellerName = `E2E Seller ${suffix}`

  test.beforeAll(() => {
    seedSeller(sellerName, `e2e-seller-${suffix}`, email, password)
  })

  test("logs in and sees the seller's own vendor name on the dashboard", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Log in" }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole("heading", { name: sellerName })).toBeVisible()
  })

  test("wrong password shows a generic error, not account enumeration", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("the-wrong-password")
    await page.getByRole("button", { name: "Log in" }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText("Invalid email or password")).toBeVisible()
  })
})
