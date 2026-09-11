import { test, expect } from "@playwright/test"

const BACKEND_URL = "http://localhost:9000"

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

async function get(path: string, token?: string) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return { status: response.status, data: await response.json() }
}

/**
 * Requires the backend running with ENABLE_TEST_SUPPORT_ROUTES=true (same
 * requirement as discovery.spec.ts) - this spec
 * seeds sellers/products directly via the backend API since the part under
 * test is the storefront cart experience, not the seller/admin product
 * lifecycle (which has its own dedicated specs).
 */
test.describe("Multi-vendor shopping cart", () => {
  const suffix = Date.now()
  let categoryId: string
  let adminToken: string

  let productA: { title: string; code: string; variantId: string; sellerSlug: string }
  let productB: { title: string; code: string; variantId: string; sellerSlug: string }

  async function provisionSellerWithApprovedProduct(
    name: string,
    overrides: Record<string, unknown>
  ) {
    const slug = `${name}-${suffix}`
    const email = `${slug}@example.test`
    const password = "correct-horse-battery-s"
    await post("/seller-test-support/provision", { name: slug, slug, email, password })
    const login = await post("/auth/seller_user/emailpass", { email, password })
    const sellerToken = login.data.token as string

    const created = await post(
      "/seller/products",
      {
        title: `${name} Product ${suffix}`,
        description: "Created for cart E2E testing.",
        category_id: categoryId,
        base_price: 5000,
        variants: [{ color: "Blue", size: "M", inventory_quantity: 10 }],
        ...overrides,
      },
      sellerToken
    )
    await post(`/seller/products/${created.data.listing.id}/submit`, undefined, sellerToken)
    await post(
      `/admin/product-listings/${created.data.listing.id}/approve`,
      undefined,
      adminToken
    )
    const detail = await get(`/seller/products/${created.data.listing.id}`, sellerToken)

    return {
      title: created.data.product.title as string,
      code: created.data.listing.product_code as string,
      variantId: detail.data.product.variants[0].id as string,
      sellerSlug: slug,
    }
  }

  test.beforeAll(async () => {
    const { execFileSync } = await import("node:child_process")
    const path = await import("node:path")
    const adminEmail = `e2e-cart-admin-${suffix}@example.test`
    const adminPassword = "correct-horse-battery-admin"
    execFileSync("npx", ["medusa", "user", "-e", adminEmail, "-p", adminPassword], {
      cwd: path.resolve(__dirname, "../../backend"),
      stdio: "pipe",
    })
    const adminLogin = await post("/auth/user/emailpass", {
      email: adminEmail,
      password: adminPassword,
    })
    adminToken = adminLogin.data.token

    const category = await post("/admin/categories", { name: `E2E Cart ${suffix}` }, adminToken)
    categoryId = category.data.category.id

    productA = await provisionSellerWithApprovedProduct("CartVendorA", {})
    productB = await provisionSellerWithApprovedProduct("CartVendorB", {
      variants: [{ color: "Red", size: "L", inventory_quantity: 5 }],
    })
  })

  test("guest adds products from two different vendors and sees one unified Bawi cart", async ({
    page,
  }) => {
    await page.goto(`/products/${productA.code}`)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to cart")).toBeVisible()

    await page.goto(`/products/${productB.code}`)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to cart")).toBeVisible()

    await page.goto("/cart")
    await expect(page.getByText(productA.title)).toBeVisible()
    await expect(page.getByText(productB.title)).toBeVisible()
    // One unified cart heading, not a per-vendor grouping anywhere.
    await expect(page.getByRole("heading", { name: "Your cart" })).toBeVisible()
  })

  test("guest updates a quantity and removes an item", async ({ page }) => {
    await page.goto(`/products/${productA.code}`)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to cart")).toBeVisible()

    await page.goto("/cart")
    const quantityInput = page.getByLabel("Quantity")
    await quantityInput.fill("3")
    await page.getByRole("button", { name: "Update" }).click()
    await expect(page.getByLabel("Quantity")).toHaveValue("3")

    await page.getByRole("button", { name: "Remove" }).click()
    await expect(page.getByText("Your cart is empty")).toBeVisible()
  })

  test("no vendor identity or private SKU appears in the cart UI or network response", async ({
    page,
  }) => {
    let cartResponseBody = ""
    page.on("response", async (response) => {
      if (response.url().includes("/store/cart") && response.request().method() === "POST") {
        cartResponseBody += await response.text()
      }
    })

    await page.goto(`/products/${productA.code}`)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to cart")).toBeVisible()

    await page.goto("/cart")
    await expect(page.getByText(productA.title)).toBeVisible()
    await expect(page.getByText("Bawi Shopping Seller")).toBeVisible()
    await expect(page.getByText(productA.sellerSlug)).not.toBeVisible()

    expect(cartResponseBody).not.toMatch(/vendor_id/i)
    expect(cartResponseBody).not.toMatch(/seller_id/i)
    expect(cartResponseBody).not.toMatch(new RegExp(productA.sellerSlug, "i"))
  })

  test("an item that becomes unavailable after being added is clearly flagged", async ({
    page,
  }) => {
    const flaggable = await provisionSellerWithApprovedProduct("CartVendorFlag", {
      variants: [{ color: "Black", size: "S", inventory_quantity: 3 }],
    })

    await page.goto(`/products/${flaggable.code}`)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to cart")).toBeVisible()

    await post("/seller-test-support/set-variant-availability", {
      variant_id: flaggable.variantId,
      stocked_quantity: 0,
    })

    await page.goto("/cart")
    // Setting stocked_quantity to 0 flags the item as exceeding available
    // inventory (not "unavailable" - that code is reserved for a listing
    // that's no longer approved/purchasable at all, see cart-response.ts).
    await expect(page.getByText("Only a limited quantity is available")).toBeVisible()
    await expect(page.getByText("Resolve the issues below to continue.")).toBeVisible()
  })

  test("registering with items already in the guest cart merges them into the account without duplicates", async ({
    page,
  }) => {
    await page.goto(`/products/${productB.code}`)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to cart")).toBeVisible()

    const email = `e2e-cart-register-${suffix}@example.test`
    await page.goto("/register")
    await page.getByLabel("First name").fill("Cart")
    await page.getByLabel("Last name").fill("Tester")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill("Correct1horse")
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page).toHaveURL(/\/account$/)

    await page.goto("/cart")
    await expect(page.getByText(productB.title)).toBeVisible()
    // Exactly one line item for this product - not duplicated by the merge.
    await expect(page.getByText(productB.title)).toHaveCount(1)
  })

  test("a returning customer's authenticated cart is still available after logging in again later", async ({
    page,
  }) => {
    const email = `e2e-cart-login-${suffix}@example.test`
    const password = "Correct1horse"

    await page.goto("/register")
    await page.getByLabel("First name").fill("Return")
    await page.getByLabel("Last name").fill("Customer")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Create account" }).click()
    await expect(page).toHaveURL(/\/account$/)

    await page.goto(`/products/${productA.code}`)
    await page.getByRole("button", { name: "Add to cart" }).click()
    await expect(page.getByText("Added to cart")).toBeVisible()

    // Simulate returning later: fresh context via clearing cookies, then log
    // back in - the cart must resolve by customer_id, not the old cookie.
    await page.context().clearCookies()

    await page.goto("/login")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Password").fill(password)
    await page.getByRole("button", { name: "Log in" }).click()
    await expect(page).toHaveURL(/\/account$/)

    await page.goto("/cart")
    await expect(page.getByText(productA.title)).toBeVisible()
  })
})
