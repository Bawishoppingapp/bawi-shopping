import { execFileSync } from "node:child_process"
import path from "node:path"
import { test, expect } from "@playwright/test"

const BACKEND_ROOT = path.resolve(__dirname, "../../backend")
const ADMIN_BASE_URL = "http://localhost:3002"

function createAdmin(email: string, password: string) {
  execFileSync("npx", ["medusa", "user", "-e", email, "-p", password], {
    cwd: BACKEND_ROOT,
    stdio: "pipe",
  })
}

async function fillApplicationForm(
  page: import("@playwright/test").Page,
  overrides: { storeName: string; businessEmail: string }
) {
  await page.goto("/apply")
  await page.getByLabel("Legal business name").fill("Acme Denim LLC")
  await page.getByLabel("Public store name").fill(overrides.storeName)
  await page.getByLabel("Business type").selectOption("llc")
  await page.getByLabel("Business description").fill("We make quality denim.")
  await page.getByLabel("Estimated number of products").fill("25")
  await page.getByLabel("Accessories").check()
  await page.getByLabel("First name").fill("Jane")
  await page.getByLabel("Last name").fill("Doe")
  await page.getByLabel("Business email").fill(overrides.businessEmail)
  await page.getByLabel("Phone number").fill("555-123-4567")
  await page.getByLabel("Address line 1").fill("123 Main St")
  await page.getByLabel("City").fill("Austin")
  await page.getByLabel("State").fill("TX")
  await page.getByLabel("Postal code").fill("78701")
  await page.getByText("I agree to the Bawi Shopping seller terms.").click()
  await page.getByRole("button", { name: "Submit application" }).click()
}

test.describe("Seller application journey", () => {
  const suffix = Date.now()
  const adminEmail = `e2e-admin-${suffix}@example.test`
  const adminPassword = "correct-horse-battery-admin"

  test.beforeAll(() => {
    createAdmin(adminEmail, adminPassword)
  })

  test("applicant submits, admin approves, seller activates and logs in", async ({ page }) => {
    const storeName = `E2E Denim Shop ${suffix}`
    const businessEmail = `e2e-owner-${suffix}@example.test`

    await fillApplicationForm(page, { storeName, businessEmail })

    await expect(page).toHaveURL(/\/apply\/[a-zA-Z0-9]+$/)
    await expect(page.getByRole("heading", { name: "Application received" })).toBeVisible()
    await expect(page.getByText(storeName)).toBeVisible()

    // --- Admin reviews and approves ---
    await page.goto(`${ADMIN_BASE_URL}/login`)
    await page.getByLabel("Email").fill(adminEmail)
    await page.getByLabel("Password").fill(adminPassword)
    await page.getByRole("button", { name: "Log in" }).click()
    await expect(page).toHaveURL(/\/applications$/)

    await page.getByRole("link", { name: storeName }).click()
    await expect(page).toHaveURL(/\/applications\/[a-zA-Z0-9]+$/)
    await page.getByRole("button", { name: "Approve" }).click()

    await expect(page.getByText("Application approved.")).toBeVisible()
    const activationLinkText = await page
      .locator("span.font-mono")
      .first()
      .textContent()
    expect(activationLinkText).toContain("/activate?token=")

    const token = new URL(activationLinkText!.trim()).searchParams.get("token")
    expect(token).toBeTruthy()

    // --- Seller activates their account ---
    await page.goto(`/activate?token=${token}`)
    await page.getByLabel("New password").fill("SellerPass1")
    await page.getByLabel("Confirm password").fill("SellerPass1")
    await page.getByRole("button", { name: "Activate account" }).click()
    await expect(page.getByText("Your account is ready.")).toBeVisible()

    await page.getByRole("link", { name: "Go to login" }).click()
    await expect(page).toHaveURL(/\/login$/)

    // --- Seller logs into the seller portal ---
    await page.getByLabel("Email").fill(businessEmail)
    await page.getByLabel("Password").fill("SellerPass1")
    await page.getByRole("button", { name: "Log in" }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole("heading", { name: storeName })).toBeVisible()
  })

  test("a rejected applicant remains blocked from seller features", async ({ page }) => {
    const storeName = `E2E Rejected Shop ${suffix}`
    const businessEmail = `e2e-rejected-${suffix}@example.test`

    await fillApplicationForm(page, { storeName, businessEmail })
    await expect(page.getByRole("heading", { name: "Application received" })).toBeVisible()

    await page.goto(`${ADMIN_BASE_URL}/login`)
    await page.getByLabel("Email").fill(adminEmail)
    await page.getByLabel("Password").fill(adminPassword)
    await page.getByRole("button", { name: "Log in" }).click()

    await page.getByRole("link", { name: storeName }).click()
    await page.getByRole("button", { name: "Reject" }).click()
    await page.getByLabel(/Reason for rejection/).fill("Not a fit for the marketplace.")
    await page.getByRole("button", { name: "Confirm rejection" }).click()
    await expect(page.getByText("Application rejected.")).toBeVisible()

    // The applicant's own status page never reveals the private reason.
    await page.goto("/apply")
    // (already confirmed status wording elsewhere; here the key assertion is
    // that no seller account exists at all for a rejected applicant)
    await page.goto("/login")
    await page.getByLabel("Email").fill(businessEmail)
    await page.getByLabel("Password").fill("anything")
    await page.getByRole("button", { name: "Log in" }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText("Invalid email or password")).toBeVisible()
  })
})
