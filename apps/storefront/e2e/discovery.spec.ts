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

async function post(path: string, body?: unknown, token?: string) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

/**
 * Discovery has its own dedicated seller-application/approval/product
 * journeys already covered elsewhere (product-creation.spec.ts). This spec
 * seeds an approved product and a never-submitted draft directly via the
 * backend API - the part under test is browsing/search/filter/sort on the
 * storefront, not the seller/admin product lifecycle.
 */
test.describe("Storefront product discovery", () => {
  const suffix = Date.now()
  const adminEmail = `e2e-discovery-admin-${suffix}@example.test`
  const adminPassword = "correct-horse-battery-admin"
  const sellerEmail = `e2e-discovery-seller-${suffix}@example.test`
  const sellerPassword = "correct-horse-battery-s"
  const sellerSlug = `e2e-discovery-seller-${suffix}`

  let adminToken: string
  let sellerToken: string
  let categoryId: string
  let categoryHandle: string
  const approvedTitle = `E2E Discoverable Jacket ${suffix}`
  const otherSizeTitle = `E2E Other Size Jacket ${suffix}`
  const draftTitle = `E2E Hidden Jacket ${suffix}`

  test.beforeAll(async () => {
    createAdmin(adminEmail, adminPassword)

    const adminLogin = await post("/auth/user/emailpass", {
      email: adminEmail,
      password: adminPassword,
    })
    adminToken = adminLogin.data.token

    const category = await post(
      "/admin/categories",
      { name: `E2E Jackets ${suffix}` },
      adminToken
    )
    categoryId = category.data.category.id
    categoryHandle = category.data.category.handle

    await post("/seller-test-support/provision", {
      name: `E2E Discovery Seller ${suffix}`,
      slug: sellerSlug,
      email: sellerEmail,
      password: sellerPassword,
    })
    const sellerLogin = await post("/auth/seller_user/emailpass", {
      email: sellerEmail,
      password: sellerPassword,
    })
    sellerToken = sellerLogin.data.token

    // Approved product - must be discoverable everywhere.
    const approved = await post(
      "/seller/products",
      {
        title: approvedTitle,
        description: "Discoverable via search and category browsing.",
        category_id: categoryId,
        base_price: 7500,
        variants: [{ color: "Olive", size: "M", inventory_quantity: 4 }],
      },
      sellerToken
    )
    await post(`/seller/products/${approved.data.listing.id}/submit`, undefined, sellerToken)
    await post(
      `/admin/product-listings/${approved.data.listing.id}/approve`,
      undefined,
      adminToken
    )

    // A second approved product in a different size, so the size filter has
    // a real, selectable non-matching facet value to narrow against.
    const otherSize = await post(
      "/seller/products",
      {
        title: otherSizeTitle,
        description: "Same category, different size - used to test filtering.",
        category_id: categoryId,
        base_price: 8000,
        variants: [{ color: "Navy", size: "L", inventory_quantity: 4 }],
      },
      sellerToken
    )
    await post(`/seller/products/${otherSize.data.listing.id}/submit`, undefined, sellerToken)
    await post(
      `/admin/product-listings/${otherSize.data.listing.id}/approve`,
      undefined,
      adminToken
    )

    // Draft product - must never appear anywhere on the storefront.
    await post(
      "/seller/products",
      {
        title: draftTitle,
        description: "Still a draft - must stay invisible to customers.",
        category_id: categoryId,
        base_price: 7500,
        variants: [{ color: "Black", size: "L", inventory_quantity: 4 }],
      },
      sellerToken
    )
  })

  test("the homepage's new-arrivals rail shows the approved product and never the draft", async ({
    page,
  }) => {
    await page.goto("/")
    await expect(page.getByText(approvedTitle)).toBeVisible()
    await expect(page.getByText(draftTitle)).not.toBeVisible()
  })

  test("browsing the category page shows the approved product and never the draft", async ({
    page,
  }) => {
    await page.goto(`/categories/${categoryHandle}`)
    await expect(page.getByText(approvedTitle)).toBeVisible()
    await expect(page.getByText(draftTitle)).not.toBeVisible()
  })

  test("searching by keyword finds the approved product but never the draft", async ({
    page,
  }) => {
    await page.goto("/")
    await page.getByPlaceholder("Search products").fill(approvedTitle)
    await page.getByPlaceholder("Search products").press("Enter")
    await expect(page).toHaveURL(/\/search\?/)
    // "Results for <query>" also contains the title text, so scope to the
    // product card link rather than any text match on the page.
    await expect(page.getByRole("link", { name: approvedTitle })).toBeVisible()

    await page.getByPlaceholder("Search products").fill(draftTitle)
    await page.getByPlaceholder("Search products").press("Enter")
    await expect(page.getByText("No products found")).toBeVisible()
    await expect(page.getByRole("link", { name: draftTitle })).not.toBeVisible()
  })

  test("filtering by size narrows results, and sorting changes the request without erroring", async ({
    page,
  }) => {
    await page.goto(`/categories/${categoryHandle}`)
    await expect(page.getByRole("link", { name: approvedTitle })).toBeVisible()
    await expect(page.getByRole("link", { name: otherSizeTitle })).toBeVisible()

    // Selecting size M keeps only the M product visible.
    await page.getByLabel("Size").selectOption("M")
    await page.getByRole("button", { name: "Apply filters" }).click()
    await expect(page.getByRole("link", { name: approvedTitle })).toBeVisible()
    await expect(page.getByRole("link", { name: otherSizeTitle })).not.toBeVisible()

    // Selecting size L flips which product is visible.
    await page.getByLabel("Size").selectOption("L")
    await page.getByRole("button", { name: "Apply filters" }).click()
    await expect(page.getByRole("link", { name: approvedTitle })).not.toBeVisible()
    await expect(page.getByRole("link", { name: otherSizeTitle })).toBeVisible()

    await page.getByLabel("Size").selectOption("")
    await page.getByRole("button", { name: "Apply filters" }).click()
    await expect(page.getByRole("link", { name: approvedTitle })).toBeVisible()

    await page.getByLabel("Sort by").selectOption("price_asc")
    await expect(page).toHaveURL(/sort=price_asc/)
    await expect(page.getByRole("link", { name: approvedTitle })).toBeVisible()
  })

  test("mobile viewport exposes filters through a drawer", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/categories/${categoryHandle}`)

    await page.getByRole("button", { name: "Filters" }).click()
    await expect(page.getByRole("button", { name: "Close" })).toBeVisible()
    // Both the (CSS-hidden) desktop sidebar and the open mobile drawer keep
    // their own copy of the filter form in the DOM - scope to the drawer
    // to avoid a strict-mode match on both.
    const drawer = page.getByTestId("mobile-filter-drawer")
    await expect(drawer.getByLabel("Category")).toBeVisible()
  })
})
