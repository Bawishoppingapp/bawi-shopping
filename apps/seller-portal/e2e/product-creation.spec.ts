import { execFileSync } from "node:child_process"
import path from "node:path"
import { test, expect } from "@playwright/test"

const BACKEND_ROOT = path.resolve(__dirname, "../../backend")
const BACKEND_URL = "http://localhost:9000"
const ADMIN_BASE_URL = "http://localhost:3002"
const STOREFRONT_BASE_URL = "http://localhost:3000"

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

test.describe("Seller product creation, admin approval, and public viewing", () => {
  const suffix = Date.now()
  const adminEmail = `e2e-product-admin-${suffix}@example.test`
  const adminPassword = "correct-horse-battery-admin"
  const sellerEmail = `e2e-product-seller-${suffix}@example.test`
  const sellerPassword = "correct-horse-battery-s"

  test.beforeAll(async () => {
    createAdmin(adminEmail, adminPassword)
    await provisionSeller(
      `E2E Product Seller ${suffix}`,
      `e2e-product-seller-${suffix}`,
      sellerEmail,
      sellerPassword
    )
  })

  test("seller creates a product with variants, submits, admin approves, and it appears on the storefront", async ({
    page,
  }) => {
    const productTitle = `E2E Denim Jacket ${suffix}`

    // --- Seller logs in and creates a product ---
    await page.goto("/login")
    await page.getByLabel("Email").fill(sellerEmail)
    await page.getByLabel("Password").fill(sellerPassword)
    await page.getByRole("button", { name: "Log in" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.getByRole("link", { name: "Manage products" }).click()
    await expect(page).toHaveURL(/\/products$/)
    await page.getByRole("link", { name: "New product" }).click()

    await page.getByLabel("Title").fill(productTitle)
    await page.getByLabel("Description").fill("A sturdy denim jacket for E2E testing.")
    await page.getByLabel("Category").selectOption({ index: 1 })
    await page.getByLabel(/Base price/).fill("8999")
    await page.getByLabel("Color").fill("Blue")
    await page.getByLabel("Size").fill("M")
    await page.getByLabel("Inventory qty").fill("12")
    await page.getByRole("button", { name: "Save draft" }).click()

    await expect(page).toHaveURL(/\/products\/[a-zA-Z0-9]+$/)
    await expect(page.getByRole("heading", { name: productTitle })).toBeVisible()
    await expect(page.getByText("Draft")).toBeVisible()

    const productCodeText = await page.getByText(/Product code:/).textContent()
    const productCode = productCodeText!.replace("Product code:", "").trim()

    // --- Submit for review ---
    await page.getByRole("button", { name: "Submit for review" }).click()
    await expect(
      page.getByText("Submitted for review - editing is disabled until an admin approves or rejects it.")
    ).toBeVisible()

    // --- Admin approves ---
    await page.goto(`${ADMIN_BASE_URL}/login`)
    await page.getByLabel("Email").fill(adminEmail)
    await page.getByLabel("Password").fill(adminPassword)
    await page.getByRole("button", { name: "Log in" }).click()
    await expect(page).toHaveURL(/\/applications$/)

    await page.goto(`${ADMIN_BASE_URL}/products`)
    await page.getByRole("link", { name: productTitle }).click()
    await expect(page).toHaveURL(/\/products\/[a-zA-Z0-9]+$/)
    await page.getByRole("button", { name: "Approve" }).click()
    await expect(
      page.getByText("Product approved and published to the storefront.")
    ).toBeVisible()

    // --- Customer views the approved product on the storefront ---
    await page.goto(`${STOREFRONT_BASE_URL}/products/${productCode}`)
    await expect(page.getByRole("heading", { name: productTitle })).toBeVisible()
    await expect(page.getByText("$89.99")).toBeVisible()
    await expect(page.getByText(/Sold by/)).toBeVisible()
  })

  test("seller A is blocked from editing seller B's product", async ({ page }) => {
    const sellerBEmail = `e2e-product-seller-b-${suffix}@example.test`
    await provisionSeller(
      `E2E Product Seller B ${suffix}`,
      `e2e-product-seller-b-${suffix}`,
      sellerBEmail,
      "correct-horse-battery-b"
    )

    // Seller B creates a product.
    await page.goto("/login")
    await page.getByLabel("Email").fill(sellerBEmail)
    await page.getByLabel("Password").fill("correct-horse-battery-b")
    await page.getByRole("button", { name: "Log in" }).click()
    await page.getByRole("link", { name: "Manage products" }).click()
    await page.getByRole("link", { name: "New product" }).click()

    await page.getByLabel("Title").fill(`Seller B Product ${suffix}`)
    await page.getByLabel("Description").fill("Owned by seller B only.")
    await page.getByLabel("Category").selectOption({ index: 1 })
    await page.getByLabel(/Base price/).fill("1000")
    await page.getByLabel("Color").fill("Black")
    await page.getByLabel("Size").fill("S")
    await page.getByLabel("Inventory qty").fill("1")
    await page.getByRole("button", { name: "Save draft" }).click()
    await expect(page.getByText("Product code:")).toBeVisible()
    const url = page.url()
    const listingId = url.split("/products/")[1]
    expect(listingId).not.toBe("new")

    // Seller A (from the previous test) tries to open seller B's product
    // directly by URL - the backend treats it as not found.
    await page.goto("/login")
    await page.getByLabel("Email").fill(sellerEmail)
    await page.getByLabel("Password").fill(sellerPassword)
    await page.getByRole("button", { name: "Log in" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole("heading", { name: /E2E Product Seller \d+/ })).toBeVisible()

    const response = await page.goto(`/products/${listingId}`)
    expect(response?.status()).toBe(404)
  })
})
