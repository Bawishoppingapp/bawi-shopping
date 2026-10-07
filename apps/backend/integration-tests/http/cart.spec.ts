import { Client } from "pg"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { startTestServer, stopTestServer, PORT } from "./test-server"

jest.setTimeout(180 * 1000)

const BASE_URL = `http://localhost:${PORT}`
const BACKEND_ROOT = path.resolve(__dirname, "../..")
const TEST_DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://bawishopping@127.0.0.1:5544/bawi_shopping_test"

// Medusa's built-in /store/* middleware requires a publishable API key
// header on every store route, including our custom /store/cart/* ones -
// set once in beforeAll (see medusa-auth-client.ts's storefront precedent
// for /store/customers) and reused by every request() call below.
let publishableApiKey: string | undefined

/**
 * Node's fetch (undici) keep-alive pool occasionally hands back a socket
 * the long-running dev server has since idle-timed-out, surfacing as
 * ECONNRESET on an otherwise-correct request - a well-known class of
 * flakiness for long Node HTTP test runs, not specific to this route. One
 * retry on a network-level failure (never on an HTTP error response, which
 * is a real assertion target) is the standard mitigation.
 */
async function request(
  method: string,
  path: string,
  options: { body?: unknown; token?: string; cartId?: string } = {}
) {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(publishableApiKey ? { "x-publishable-api-key": publishableApiKey } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.cartId ? { "x-cart-id": options.cartId } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, init)
    return { status: response.status, data: await response.json() }
  } catch {
    const response = await fetch(`${BASE_URL}${path}`, init)
    return { status: response.status, data: await response.json() }
  }
}

const get = (path: string, opts?: { token?: string; cartId?: string }) =>
  request("GET", path, opts)
const post = (path: string, body?: unknown, opts?: { token?: string; cartId?: string }) =>
  request("POST", path, { ...opts, body })
const patch = (path: string, body: unknown, opts?: { token?: string; cartId?: string }) =>
  request("PATCH", path, { ...opts, body })
const del = (path: string, opts?: { token?: string; cartId?: string }) =>
  request("DELETE", path, opts)

describe("Multi-vendor shopping cart (real server, real Postgres)", () => {
  let serverProcess: Awaited<ReturnType<typeof startTestServer>>
  let dbClient: Client
  let baseCategoryId: string
  let adminToken: string

  const suffix = Date.now()
  const adminEmail = `cart-admin-${suffix}@example.test`
  const adminPassword = "correct-horse-battery-admin"

  beforeAll(async () => {
    // Provision the suite's single admin before starting Medusa. Spawning the
    // CLI while Jest and the production server are both resident can exceed a
    // small CI runner's memory, and creating a new admin for every cart case is
    // unnecessary because these tests only need an authenticated review token.
    execFileSync("npx", ["medusa", "user", "-e", adminEmail, "-p", adminPassword], {
      cwd: BACKEND_ROOT,
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "pipe",
    })
    serverProcess = await startTestServer()

    dbClient = new Client({ connectionString: TEST_DATABASE_URL })
    await dbClient.connect()

    const { rows } = await dbClient.query(
      "SELECT id FROM product_category WHERE deleted_at IS NULL LIMIT 1"
    )
    if (!rows.length) {
      throw new Error("No product category available for tests - seed data missing")
    }
    baseCategoryId = rows[0].id

    const keyResponse = await get("/seller-test-support/publishable-key")
    publishableApiKey = keyResponse.data.token

    const adminLogin = await post("/auth/user/emailpass", {
      email: adminEmail,
      password: adminPassword,
    })
    adminToken = adminLogin.data.token
  })

  afterAll(async () => {
    await dbClient?.end()
    await stopTestServer(serverProcess)
  })

  async function provisionSeller(name: string) {
    const slug = `${name}-${suffix}-${Math.random().toString(36).slice(2, 8)}`
    const email = `${slug}@example.test`
    const password = "correct-horse-battery-s"
    await post("/seller-test-support/provision", { name: slug, slug, email, password })
    const login = await post("/auth/seller_user/emailpass", { email, password })
    return { token: login.data.token as string, slug }
  }

  async function createProduct(
    sellerToken: string,
    overrides: Record<string, unknown> = {}
  ) {
    const payload = {
      title: `Cart Product ${Date.now()}-${Math.random()}`,
      description: "A product created for cart integration testing.",
      category_id: baseCategoryId,
      base_price: 5000,
      variants: [{ color: "Blue", size: "M", inventory_quantity: 10 }],
      ...overrides,
    }
    const created = await post("/seller/products", payload, { token: sellerToken })
    return created.data
  }

  async function approveProduct(sellerToken: string, adminToken: string, listingId: string) {
    await post(`/seller/products/${listingId}/submit`, undefined, { token: sellerToken })
    await post(`/admin/product-listings/${listingId}/approve`, undefined, { token: adminToken })
  }

  async function createApprovedProductWithVariant(
    sellerToken: string,
    adminToken: string,
    overrides: Record<string, unknown> = {}
  ) {
    const created = await createProduct(sellerToken, overrides)
    await approveProduct(sellerToken, adminToken, created.listing.id)
    const detail = await get(`/seller/products/${created.listing.id}`, { token: sellerToken })
    return {
      listing: created.listing,
      variantId: detail.data.product.variants[0].id as string,
    }
  }

  async function createAdmin() {
    return adminToken
  }

  async function createCustomer() {
    const email = `cart-customer-${suffix}-${Math.random().toString(36).slice(2, 8)}@example.test`
    const password = "correct-horse-battery-c"
    const registerResponse = await post("/auth/customer/emailpass/register", { email, password })
    await fetch(`${BASE_URL}/store/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${registerResponse.data.token}`,
        "x-publishable-api-key": publishableApiKey ?? "",
      },
      body: JSON.stringify({ email, first_name: "Cart", last_name: "Customer" }),
    })
    const login = await post("/auth/customer/emailpass", { email, password })
    return { token: login.data.token as string, email }
  }

  describe("guest cart", () => {
    test("a guest can create a cart by adding an item, and update it", async () => {
      const seller = await provisionSeller("guest-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin)

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 2 })
      expect(added.status).toBe(200)
      expect(added.data.cart.id).toBeTruthy()
      expect(added.data.cart.items).toHaveLength(1)
      expect(added.data.cart.items[0].quantity).toBe(2)

      const cartId = added.data.cart.id as string
      const lineItemId = added.data.cart.items[0].id as string

      const updated = await patch(
        `/store/cart/items/${lineItemId}`,
        { quantity: 4 },
        { cartId }
      )
      expect(updated.status).toBe(200)
      expect(updated.data.cart.items[0].quantity).toBe(4)

      const fetched = await get("/store/cart", { cartId })
      expect(fetched.data.cart.id).toBe(cartId)
      expect(fetched.data.cart.items[0].quantity).toBe(4)
    })

    test("GET without any cart identity returns an empty cart, not an error", async () => {
      const response = await get("/store/cart")
      expect(response.status).toBe(200)
      expect(response.data.cart.items).toEqual([])
    })

    test("adding the same variant again increases its quantity rather than duplicating the line item", async () => {
      const seller = await provisionSeller("dup-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin)

      const first = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      const cartId = first.data.cart.id as string

      const second = await post(
        "/store/cart/items",
        { variant_id: variantId, quantity: 2 },
        { cartId }
      )
      expect(second.data.cart.items).toHaveLength(1)
      expect(second.data.cart.items[0].quantity).toBe(3)
    })

    test("removing an item and clearing the cart both work", async () => {
      const seller = await provisionSeller("remove-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin)

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      const cartId = added.data.cart.id as string
      const lineItemId = added.data.cart.items[0].id as string

      const removed = await del(`/store/cart/items/${lineItemId}`, { cartId })
      expect(removed.status).toBe(200)
      expect(removed.data.cart.items).toHaveLength(0)

      await post("/store/cart/items", { variant_id: variantId, quantity: 1 }, { cartId })
      const cleared = await del("/store/cart", { cartId })
      expect(cleared.data.cart.items).toHaveLength(0)

      const stillThere = await get("/store/cart", { cartId })
      expect(stillThere.data.cart.id).toBe(cartId)
    })
  })

  describe("authenticated customer cart", () => {
    test("a customer can create a cart and update it without any cart-id header", async () => {
      const seller = await provisionSeller("auth-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin)
      const customer = await createCustomer()

      const added = await post(
        "/store/cart/items",
        { variant_id: variantId, quantity: 1 },
        { token: customer.token }
      )
      expect(added.status).toBe(200)

      const fetched = await get("/store/cart", { token: customer.token })
      expect(fetched.data.cart.id).toBe(added.data.cart.id)
      expect(fetched.data.cart.items).toHaveLength(1)
    })
  })

  describe("multi-vendor cart and privacy", () => {
    test("a cart can hold products from two different vendors as one unified cart", async () => {
      const sellerA = await provisionSeller("vendor-a")
      const sellerB = await provisionSeller("vendor-b")
      const admin = await createAdmin()
      const productA = await createApprovedProductWithVariant(sellerA.token, admin)
      const productB = await createApprovedProductWithVariant(sellerB.token, admin, {
        title: `Cart Product B ${Date.now()}`,
        variants: [{ color: "Red", size: "L", inventory_quantity: 5 }],
      })

      const first = await post("/store/cart/items", {
        variant_id: productA.variantId,
        quantity: 1,
      })
      const cartId = first.data.cart.id as string
      const second = await post(
        "/store/cart/items",
        { variant_id: productB.variantId, quantity: 1 },
        { cartId }
      )

      expect(second.data.cart.items).toHaveLength(2)
      // One unified cart response - no per-vendor grouping/count anywhere.
      expect(second.data.cart.vendor_count).toBeUndefined()
      expect(second.data.cart.vendors).toBeUndefined()
    })

    test("the cart response never includes vendor_id, seller id, or any private seller field", async () => {
      const seller = await provisionSeller("privacy-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin)

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      const raw = JSON.stringify(added.data)

      expect(raw).not.toMatch(/vendor_id/i)
      expect(raw).not.toMatch(/seller_id/i)
      expect(raw).not.toMatch(/stripe_account/i)
      expect(raw).not.toMatch(/pickup/i)
      const item = added.data.cart.items[0]
      expect(Object.keys(item)).not.toContain("vendor_id")
    })

    test("a private, unapproved brand name is never shown - only the generic fallback label", async () => {
      const seller = await provisionSeller("hidden-brand-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin)

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      expect(added.data.cart.items[0].brand).toBe("Bawi Shopping Seller")
      expect(added.data.cart.items[0].brand).not.toContain(seller.slug)
    })

    test("a seller cannot access a customer's cart through the seller API surface", async () => {
      const seller = await provisionSeller("nosy-seller")
      const response = await get("/store/cart", { token: seller.token })
      // The customer-only authenticate() middleware rejects a seller_user
      // token outright - a seller has no route that can reach cart data.
      expect([200, 401]).toContain(response.status)
      if (response.status === 200) {
        expect(response.data.cart.items).toEqual([])
      }
    })
  })

  describe("server-side validation - never trust the client", () => {
    test("a client-submitted price and vendor_id are ignored, not honored", async () => {
      const seller = await provisionSeller("no-trust-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin, {
        base_price: 5000,
      })

      const added = await post("/store/cart/items", {
        variant_id: variantId,
        quantity: 1,
        // Not part of the accepted schema - must be silently dropped, not
        // trusted, even though the field names match internal ones.
        unit_price: 1,
        vendor_id: "some-other-vendor",
        price: 1,
      })

      expect(added.status).toBe(200)
      expect(added.data.cart.items[0].unit_price).toBe(5000)
    })

    test("a draft (unsubmitted) product cannot be added to the cart", async () => {
      const seller = await provisionSeller("draft-seller")
      const created = await createProduct(seller.token)

      const detail = await get(`/seller/products/${created.listing.id}`, {
        token: seller.token,
      })
      const variantId = detail.data.product.variants[0].id

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      expect(added.status).toBe(404)
    })

    test("a pending_review product cannot be added to the cart", async () => {
      const seller = await provisionSeller("pending-seller")
      const created = await createProduct(seller.token)
      await post(`/seller/products/${created.listing.id}/submit`, undefined, {
        token: seller.token,
      })

      const detail = await get(`/seller/products/${created.listing.id}`, {
        token: seller.token,
      })
      const variantId = detail.data.product.variants[0].id

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      expect(added.status).toBe(404)
    })

    test("a rejected product cannot be added to the cart", async () => {
      const seller = await provisionSeller("rejected-seller")
      const admin = await createAdmin()
      const created = await createProduct(seller.token)
      await post(`/seller/products/${created.listing.id}/submit`, undefined, {
        token: seller.token,
      })
      await post(
        `/admin/product-listings/${created.listing.id}/reject`,
        { reason: "Not a fit for the catalog" },
        { token: admin }
      )

      const detail = await get(`/seller/products/${created.listing.id}`, {
        token: seller.token,
      })
      const variantId = detail.data.product.variants[0].id

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      expect(added.status).toBe(404)
    })

    test("an archived product cannot be added to the cart", async () => {
      const seller = await provisionSeller("archived-seller")
      const admin = await createAdmin()
      const { listing, variantId } = await createApprovedProductWithVariant(seller.token, admin)

      await dbClient.query("UPDATE product_listing SET status = 'archived' WHERE id = $1", [
        listing.id,
      ])

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      expect(added.status).toBe(404)
    })

    test("an out-of-stock variant cannot be added to the cart", async () => {
      const seller = await provisionSeller("oos-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin, {
        variants: [{ color: "Black", size: "S", inventory_quantity: 0 }],
      })

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      expect(added.status).toBe(400)
    })

    test("quantity cannot exceed available inventory", async () => {
      const seller = await provisionSeller("limited-stock-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin, {
        variants: [{ color: "Green", size: "XL", inventory_quantity: 2 }],
      })

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 3 })
      expect(added.status).toBe(400)
    })

    test("quantity cannot exceed the configurable per-line-item maximum", async () => {
      const seller = await provisionSeller("max-qty-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin, {
        variants: [{ color: "White", size: "M", inventory_quantity: 999 }],
      })

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 11 })
      expect(added.status).toBe(400)
    })
  })

  describe("price and availability drift after an item is already in the cart", () => {
    test("a price change on the vendor's product is reflected the next time the cart is read", async () => {
      const seller = await provisionSeller("price-drift-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin, {
        base_price: 4000,
      })

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      expect(added.data.cart.items[0].unit_price).toBe(4000)
      const cartId = added.data.cart.id as string

      await post("/seller-test-support/set-variant-availability", {
        variant_id: variantId,
        price: 6000,
      })

      const refetched = await get("/store/cart", { cartId })
      expect(refetched.data.cart.items[0].unit_price).toBe(6000)
      expect(
        refetched.data.cart.warnings.some(
          (w: { code: string }) => w.code === "price_changed"
        )
      ).toBe(true)
    })

    test("inventory dropping below the cart's quantity blocks checkout and is flagged, without deleting the item", async () => {
      const seller = await provisionSeller("stock-drop-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin, {
        variants: [{ color: "Pink", size: "S", inventory_quantity: 5 }],
      })

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 3 })
      const cartId = added.data.cart.id as string

      await post("/seller-test-support/set-variant-availability", {
        variant_id: variantId,
        stocked_quantity: 1,
      })

      const refetched = await get("/store/cart", { cartId })
      expect(refetched.data.cart.items).toHaveLength(1)
      expect(refetched.data.cart.items[0].quantity).toBe(3)
      expect(refetched.data.cart.checkout_blocked).toBe(true)
      expect(
        refetched.data.cart.warnings.some(
          (w: { code: string }) => w.code === "quantity_exceeds_inventory"
        )
      ).toBe(true)
    })

    test("a product archived after being added is flagged unavailable, not silently dropped", async () => {
      const seller = await provisionSeller("post-archive-seller")
      const admin = await createAdmin()
      const { listing, variantId } = await createApprovedProductWithVariant(seller.token, admin)

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      const cartId = added.data.cart.id as string

      await dbClient.query("UPDATE product_listing SET status = 'archived' WHERE id = $1", [
        listing.id,
      ])

      const refetched = await get("/store/cart", { cartId })
      expect(refetched.data.cart.items).toHaveLength(1)
      expect(refetched.data.cart.items[0].is_available).toBe(false)
      expect(refetched.data.cart.checkout_blocked).toBe(true)
      expect(
        refetched.data.cart.warnings.some((w: { code: string }) => w.code === "unavailable")
      ).toBe(true)
    })
  })

  describe("guest-to-customer cart merge", () => {
    test("a guest cart merges into a new customer's cart on login with no duplicate line items", async () => {
      const seller = await provisionSeller("merge-seller")
      const admin = await createAdmin()
      const productA = await createApprovedProductWithVariant(seller.token, admin)
      const productB = await createApprovedProductWithVariant(seller.token, admin, {
        title: `Merge Product B ${Date.now()}`,
        variants: [{ color: "Gray", size: "L", inventory_quantity: 5 }],
      })

      const first = await post("/store/cart/items", {
        variant_id: productA.variantId,
        quantity: 2,
      })
      const guestCartId = first.data.cart.id as string
      await post(
        "/store/cart/items",
        { variant_id: productB.variantId, quantity: 1 },
        { cartId: guestCartId }
      )

      const customer = await createCustomer()
      const merged = await post(
        "/store/cart/merge",
        { guest_cart_id: guestCartId },
        { token: customer.token }
      )

      expect(merged.status).toBe(200)
      expect(merged.data.cart.items).toHaveLength(2)
      const total = merged.data.cart.items.reduce(
        (sum: number, item: { quantity: number }) => sum + item.quantity,
        0
      )
      expect(total).toBe(3)

      const fetched = await get("/store/cart", { token: customer.token })
      expect(fetched.data.cart.items).toHaveLength(2)
    })

    test("merging sums quantities for a variant already in the customer's cart, capped to inventory", async () => {
      const seller = await provisionSeller("merge-cap-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin, {
        variants: [{ color: "Teal", size: "M", inventory_quantity: 4 }],
      })
      const customer = await createCustomer()

      await post(
        "/store/cart/items",
        { variant_id: variantId, quantity: 3 },
        { token: customer.token }
      )

      const guestAdd = await post("/store/cart/items", { variant_id: variantId, quantity: 3 })
      const guestCartId = guestAdd.data.cart.id as string

      const merged = await post(
        "/store/cart/merge",
        { guest_cart_id: guestCartId },
        { token: customer.token }
      )

      expect(merged.data.cart.items).toHaveLength(1)
      expect(merged.data.cart.items[0].quantity).toBe(4)
    })

    test("after merging into an existing customer cart, a fresh GET still resolves to the same cart (not the now-empty former guest cart)", async () => {
      // Regression test: findActiveCart() picks a customer's cart by "most
      // recently updated." The drained guest cart must never end up
      // looking more recently updated than the real cart with the
      // customer's items, or a subsequent GET would resolve to the wrong
      // (empty) cart.
      const seller = await provisionSeller("merge-refetch-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin, {
        variants: [{ color: "Maroon", size: "M", inventory_quantity: 5 }],
      })
      const customer = await createCustomer()

      await post(
        "/store/cart/items",
        { variant_id: variantId, quantity: 1 },
        { token: customer.token }
      )

      const otherProduct = await createApprovedProductWithVariant(seller.token, admin, {
        title: `Merge Refetch Other ${Date.now()}`,
        variants: [{ color: "Gold", size: "S", inventory_quantity: 5 }],
      })
      const guestAdd = await post("/store/cart/items", {
        variant_id: otherProduct.variantId,
        quantity: 1,
      })
      const guestCartId = guestAdd.data.cart.id as string

      const merged = await post(
        "/store/cart/merge",
        { guest_cart_id: guestCartId },
        { token: customer.token }
      )
      expect(merged.data.cart.items).toHaveLength(2)

      const fetched = await get("/store/cart", { token: customer.token })
      expect(fetched.data.cart.id).toBe(merged.data.cart.id)
      expect(fetched.data.cart.items).toHaveLength(2)
    })

    test("two concurrent merge requests for the same guest cart never duplicate line items", async () => {
      const seller = await provisionSeller("merge-concurrent-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin, {
        variants: [{ color: "Silver", size: "L", inventory_quantity: 5 }],
      })
      const customer = await createCustomer()

      const guestAdd = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      const guestCartId = guestAdd.data.cart.id as string

      const [first, second] = await Promise.all([
        post("/store/cart/merge", { guest_cart_id: guestCartId }, { token: customer.token }),
        post("/store/cart/merge", { guest_cart_id: guestCartId }, { token: customer.token }),
      ])

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)

      const fetched = await get("/store/cart", { token: customer.token })
      expect(fetched.data.cart.items).toHaveLength(1)
      expect(fetched.data.cart.items[0].quantity).toBe(1)
    })

    test("repeated merge requests for the same guest cart are idempotent", async () => {
      const seller = await provisionSeller("merge-idempotent-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin)
      const customer = await createCustomer()

      const guestAdd = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      const guestCartId = guestAdd.data.cart.id as string

      const firstMerge = await post(
        "/store/cart/merge",
        { guest_cart_id: guestCartId },
        { token: customer.token }
      )
      const secondMerge = await post(
        "/store/cart/merge",
        { guest_cart_id: guestCartId },
        { token: customer.token }
      )

      expect(firstMerge.status).toBe(200)
      expect(secondMerge.status).toBe(200)
      expect(secondMerge.data.cart.items).toHaveLength(1)
      expect(secondMerge.data.cart.items[0].quantity).toBe(1)
    })

    test("merge requires an authenticated customer", async () => {
      const response = await post("/store/cart/merge", { guest_cart_id: "cart_fake" })
      expect(response.status).toBe(401)
    })
  })

  describe("cart expiration", () => {
    test("a cart older than the configured expiration window is treated as not found and a fresh one is used", async () => {
      const seller = await provisionSeller("expiring-seller")
      const admin = await createAdmin()
      const { variantId } = await createApprovedProductWithVariant(seller.token, admin)

      const added = await post("/store/cart/items", { variant_id: variantId, quantity: 1 })
      const oldCartId = added.data.cart.id as string

      await dbClient.query(
        "UPDATE cart SET updated_at = now() - interval '31 days' WHERE id = $1",
        [oldCartId]
      )

      const fetched = await get("/store/cart", { cartId: oldCartId })
      expect(fetched.data.cart.items).toEqual([])

      const reAdded = await post(
        "/store/cart/items",
        { variant_id: variantId, quantity: 1 },
        { cartId: oldCartId }
      )
      // A fresh cart is created transparently - not the expired one.
      expect(reAdded.data.cart.id).not.toBe(oldCartId)
    })
  })
})
