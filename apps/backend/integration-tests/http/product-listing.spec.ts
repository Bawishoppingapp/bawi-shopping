import { Client } from "pg"
import {
  startTestServer,
  stopTestServer,
  PORT,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
} from "./test-server"

jest.setTimeout(120 * 1000)

const BASE_URL = `http://localhost:${PORT}`
const TEST_DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://bawishopping@127.0.0.1:5544/bawi_shopping_test"

async function post(path: string, body?: unknown, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
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
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return { status: response.status, data: await response.json() }
}

async function putRequest(path: string, body: unknown, token: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

function validProductPayload(overrides: Record<string, unknown> = {}, categoryId: string) {
  return {
    title: `Test Product ${Date.now()}-${Math.random()}`,
    description: "A product created for integration testing.",
    category_id: categoryId,
    base_price: 4999,
    variants: [{ color: "Blue", size: "M", inventory_quantity: 10 }],
    ...overrides,
  }
}

describe("Seller product creation, admin review, and public visibility", () => {
  let serverProcess: Awaited<ReturnType<typeof startTestServer>>
  let dbClient: Client
  let adminToken: string
  let customerToken: string
  let sellerAToken: string
  let sellerBToken: string
  let categoryId: string

  const suffix = Date.now()

  beforeAll(async () => {
    serverProcess = await startTestServer()

    dbClient = new Client({ connectionString: TEST_DATABASE_URL })
    await dbClient.connect()

    const { rows } = await dbClient.query(
      "SELECT id FROM product_category WHERE deleted_at IS NULL LIMIT 1"
    )
    if (!rows.length) {
      throw new Error("No product category available for tests - seed data missing")
    }
    categoryId = rows[0].id

    const adminLogin = await post("/auth/user/emailpass", {
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    })
    adminToken = adminLogin.data.token

    const customerReg = await post("/auth/customer/emailpass/register", {
      email: `product-customer-${suffix}@example.test`,
      password: "correct-horse-battery-c",
    })
    customerToken = customerReg.data.token

    await post("/seller-test-support/provision", {
      name: `Product Seller A ${suffix}`,
      slug: `product-seller-a-${suffix}`,
      email: `product-seller-a-${suffix}@example.test`,
      password: "correct-horse-battery-a",
    })
    const sellerALogin = await post("/auth/seller_user/emailpass", {
      email: `product-seller-a-${suffix}@example.test`,
      password: "correct-horse-battery-a",
    })
    sellerAToken = sellerALogin.data.token

    await post("/seller-test-support/provision", {
      name: `Product Seller B ${suffix}`,
      slug: `product-seller-b-${suffix}`,
      email: `product-seller-b-${suffix}@example.test`,
      password: "correct-horse-battery-b",
    })
    const sellerBLogin = await post("/auth/seller_user/emailpass", {
      email: `product-seller-b-${suffix}@example.test`,
      password: "correct-horse-battery-b",
    })
    sellerBToken = sellerBLogin.data.token
  })

  afterAll(async () => {
    await dbClient?.end()
    await stopTestServer(serverProcess)
  })

  test("an approved seller can create a draft product", async () => {
    const response = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    expect(response.status).toBe(201)
    expect(response.data.listing.status).toBe("draft")
    expect(response.data.listing.product_code).toMatch(/^BW-[0-9A-F]{8}$/)
    expect(response.data.product.variants).toHaveLength(1)
  })

  test("an unauthenticated caller cannot create a product", async () => {
    const response = await post("/seller/products", validProductPayload({}, categoryId))
    expect(response.status).toBe(401)
  })

  test("a customer cannot create a product", async () => {
    const response = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      customerToken
    )
    expect(response.status).toBe(401)
  })

  test("duplicate color/size combinations are rejected", async () => {
    const response = await post(
      "/seller/products",
      validProductPayload(
        {
          variants: [
            { color: "Red", size: "S", inventory_quantity: 1 },
            { color: "Red", size: "S", inventory_quantity: 2 },
          ],
        },
        categoryId
      ),
      sellerAToken
    )
    expect(response.status).toBe(400)
  })

  test("negative inventory is rejected", async () => {
    const response = await post(
      "/seller/products",
      validProductPayload(
        { variants: [{ color: "Green", size: "S", inventory_quantity: -1 }] },
        categoryId
      ),
      sellerAToken
    )
    expect(response.status).toBe(400)
  })

  test("a non-positive base price is rejected", async () => {
    const response = await post(
      "/seller/products",
      validProductPayload({ base_price: 0 }, categoryId),
      sellerAToken
    )
    expect(response.status).toBe(400)
  })

  test("the created listing's vendor is always the caller's own vendor, never a client-supplied one", async () => {
    const response = await fetch(`${BASE_URL}/seller/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sellerAToken}` },
      body: JSON.stringify({
        ...validProductPayload({}, categoryId),
        vendor_id: "seller_someone_else_totally_fake",
      }),
    })
    const data = await response.json()
    expect(response.status).toBe(201)

    const { rows } = await dbClient.query(
      "SELECT vendor_id FROM product_listing WHERE id = $1",
      [data.listing.id]
    )
    expect(rows[0].vendor_id).not.toBe("seller_someone_else_totally_fake")
    expect(rows[0].vendor_id).toBe(data.listing.vendor_id)
  })

  test("seller A cannot view or edit seller B's product", async () => {
    const created = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    const listingId = created.data.listing.id

    const viewAttempt = await get(`/seller/products/${listingId}`, sellerBToken)
    expect(viewAttempt.status).toBe(404)

    const editAttempt = await putRequest(
      `/seller/products/${listingId}`,
      validProductPayload({ title: "Hijacked title" }, categoryId),
      sellerBToken
    )
    expect(editAttempt.status).toBe(404)
  })

  test("seller A does not see seller B's products in their own list", async () => {
    await post("/seller/products", validProductPayload({}, categoryId), sellerBToken)

    const listA = await get("/seller/products", sellerAToken)
    const listB = await get("/seller/products", sellerBToken)

    const aIds = new Set(listA.data.products.map((p: { listing: { id: string } }) => p.listing.id))
    const bIds = listB.data.products.map((p: { listing: { id: string } }) => p.listing.id)
    for (const id of bIds) {
      expect(aIds.has(id)).toBe(false)
    }
  })

  test("submitting for review requires at least the created variant, then moves to pending_review", async () => {
    const created = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    const listingId = created.data.listing.id

    const submitted = await post(`/seller/products/${listingId}/submit`, undefined, sellerAToken)
    expect(submitted.status).toBe(200)
    expect(submitted.data.listing.status).toBe("pending_review")

    const { rows } = await dbClient.query(
      "SELECT count(*)::int AS count FROM audit_log WHERE entity_id = $1 AND action = 'product_listing.submitted'",
      [listingId]
    )
    expect(rows[0].count).toBe(1)
  })

  test("a draft or pending_review product is never visible on the public product route", async () => {
    const created = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    const draftCode = created.data.listing.product_code

    const draftView = await get(`/products/${draftCode}`)
    expect(draftView.status).toBe(404)

    await post(`/seller/products/${created.data.listing.id}/submit`, undefined, sellerAToken)
    const pendingView = await get(`/products/${draftCode}`)
    expect(pendingView.status).toBe(404)
  })

  test("customer and unauthenticated callers cannot approve a product", async () => {
    const created = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    await post(`/seller/products/${created.data.listing.id}/submit`, undefined, sellerAToken)

    const unauth = await post(`/admin/product-listings/${created.data.listing.id}/approve`)
    expect(unauth.status).toBe(401)

    const asCustomer = await post(
      `/admin/product-listings/${created.data.listing.id}/approve`,
      undefined,
      customerToken
    )
    expect(asCustomer.status).toBe(401)
  })

  test("admin can approve a pending product, it becomes publicly visible, and approval is idempotent", async () => {
    const created = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    const listingId = created.data.listing.id
    const code = created.data.listing.product_code
    await post(`/seller/products/${listingId}/submit`, undefined, sellerAToken)

    const approved = await post(`/admin/product-listings/${listingId}/approve`, undefined, adminToken)
    expect(approved.status).toBe(200)
    expect(approved.data.listing.status).toBe("approved")
    expect(approved.data.product.status).toBe("published")

    const publicView = await get(`/products/${code}`)
    expect(publicView.status).toBe(200)
    expect(publicView.data.product.product_code).toBe(code)

    const secondApproval = await post(
      `/admin/product-listings/${listingId}/approve`,
      undefined,
      adminToken
    )
    expect(secondApproval.status).toBe(200)
    expect(secondApproval.data.already_approved).toBe(true)

    const { rows } = await dbClient.query(
      "SELECT count(*)::int AS count FROM audit_log WHERE entity_id = $1 AND action = 'product_listing.approved'",
      [listingId]
    )
    expect(rows[0].count).toBe(1)
  })

  test("the public product response never includes the seller's vendor_id or the private variant SKU", async () => {
    const created = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    const listingId = created.data.listing.id
    const code = created.data.listing.product_code
    await post(`/seller/products/${listingId}/submit`, undefined, sellerAToken)
    await post(`/admin/product-listings/${listingId}/approve`, undefined, adminToken)

    const publicView = await get(`/products/${code}`)
    const serialized = JSON.stringify(publicView.data)
    expect(serialized).not.toContain("vendor_id")
    expect(serialized).not.toMatch(/"sku"/)
  })

  test("admin can reject a pending product with a private reason", async () => {
    const created = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    const listingId = created.data.listing.id
    await post(`/seller/products/${listingId}/submit`, undefined, sellerAToken)

    const rejected = await post(
      `/admin/product-listings/${listingId}/reject`,
      { reason: "Images are blurry." },
      adminToken
    )
    expect(rejected.status).toBe(200)
    expect(rejected.data.listing.status).toBe("rejected")

    // The seller sees their own rejection reason...
    const sellerView = await get(`/seller/products/${listingId}`, sellerAToken)
    expect(sellerView.data.listing.rejection_reason).toBe("Images are blurry.")

    // ...but it's never exposed on the public route (which 404s anyway since
    // the product isn't approved, but this also guards against a future
    // change accidentally widening what's public).
    const publicView = await get(`/products/${created.data.listing.product_code}`)
    expect(publicView.status).toBe(404)
  })

  test("rejecting without a reason is rejected", async () => {
    const created = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    await post(`/seller/products/${created.data.listing.id}/submit`, undefined, sellerAToken)

    const response = await post(
      `/admin/product-listings/${created.data.listing.id}/reject`,
      { reason: "" },
      adminToken
    )
    expect(response.status).toBe(400)
  })

  test("a rejected product can be edited (moving it back to draft) and resubmitted", async () => {
    const created = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    const listingId = created.data.listing.id
    await post(`/seller/products/${listingId}/submit`, undefined, sellerAToken)
    await post(`/admin/product-listings/${listingId}/reject`, { reason: "Needs work." }, adminToken)

    const edited = await putRequest(
      `/seller/products/${listingId}`,
      validProductPayload({ title: "Revised title" }, categoryId),
      sellerAToken
    )
    expect(edited.status).toBe(200)
    expect(edited.data.listing.status).toBe("draft")
    expect(edited.data.listing.rejection_reason).toBeNull()

    const resubmitted = await post(`/seller/products/${listingId}/submit`, undefined, sellerAToken)
    expect(resubmitted.status).toBe(200)
    expect(resubmitted.data.listing.status).toBe("pending_review")
  })

  test("an approved product cannot be edited directly", async () => {
    const created = await post(
      "/seller/products",
      validProductPayload({}, categoryId),
      sellerAToken
    )
    const listingId = created.data.listing.id
    await post(`/seller/products/${listingId}/submit`, undefined, sellerAToken)
    await post(`/admin/product-listings/${listingId}/approve`, undefined, adminToken)

    const editAttempt = await putRequest(
      `/seller/products/${listingId}`,
      validProductPayload({ title: "Should not apply" }, categoryId),
      sellerAToken
    )
    expect(editAttempt.status).toBe(422)
  })
})
