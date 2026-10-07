import { Client } from "pg"
import { startTestServer, stopTestServer, PORT } from "./test-server"

jest.setTimeout(180 * 1000)

const BASE_URL = `http://localhost:${PORT}`
const TEST_DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://bawishopping@127.0.0.1:5544/bawi_shopping_test"

let publishableApiKey: string | undefined

async function request(
  method: string,
  path: string,
  options: { body?: unknown; token?: string } = {}
) {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(publishableApiKey ? { "x-publishable-api-key": publishableApiKey } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
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

const get = (path: string, opts?: { token?: string }) => request("GET", path, opts)
const post = (path: string, body?: unknown, opts?: { token?: string }) =>
  request("POST", path, { ...opts, body })

async function postWebhook(body: unknown, signature: string | undefined) {
  const response = await fetch(`${BASE_URL}/webhooks/stripe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "Stripe-Signature": signature } : {}),
    },
    body: JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

function paymentIntentIdFromClientSecret(clientSecret: string): string {
  return clientSecret.replace(/_secret_test$/, "")
}

describe("Private fulfillment and delivery (real server, real Postgres)", () => {
  let serverProcess: Awaited<ReturnType<typeof startTestServer>>
  let dbClient: Client
  let baseCategoryId: string
  let adminToken: string

  const suffix = Date.now()

  const shippingAddress = {
    first_name: "Ada",
    last_name: "Lovelace",
    address_1: "123 Main St",
    city: "Dallas",
    province: "TX",
    postal_code: "75201",
    country_code: "US",
    phone: "+15555550100",
  }

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
    baseCategoryId = rows[0].id

    const keyResponse = await get("/seller-test-support/publishable-key")
    publishableApiKey = keyResponse.data.token

    const { execFileSync } = await import("node:child_process")
    const path = await import("node:path")
    const adminEmail = `fulfillment-admin-${suffix}@example.test`
    execFileSync("npx", ["medusa", "user", "-e", adminEmail, "-p", "correct-horse-battery-admin"], {
      cwd: path.resolve(__dirname, "../.."),
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: "pipe",
    })
    const adminLogin = await post("/auth/user/emailpass", {
      email: adminEmail,
      password: "correct-horse-battery-admin",
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

  async function createApprovedProduct(sellerToken: string) {
    const payload = {
      title: `Fulfillment Product ${Date.now()}-${Math.random()}`,
      description: "Created for fulfillment integration testing.",
      category_id: baseCategoryId,
      base_price: 5000,
      variants: [{ color: "Blue", size: "M", inventory_quantity: 10 }],
    }
    const created = await post("/seller/products", payload, { token: sellerToken })
    await post(`/seller/products/${created.data.listing.id}/submit`, undefined, {
      token: sellerToken,
    })
    await post(`/admin/product-listings/${created.data.listing.id}/approve`, undefined, {
      token: adminToken,
    })
    const detail = await get(`/seller/products/${created.data.listing.id}`, { token: sellerToken })
    return { variantId: detail.data.product.variants[0].id as string }
  }

  async function createCustomer() {
    const email = `fulfillment-customer-${suffix}-${Math.random().toString(36).slice(2, 8)}@example.test`
    const password = "correct-horse-battery-c"
    const registerResponse = await post("/auth/customer/emailpass/register", { email, password })
    await fetch(`${BASE_URL}/store/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${registerResponse.data.token}`,
        "x-publishable-api-key": publishableApiKey ?? "",
      },
      body: JSON.stringify({ email, first_name: "Ful", last_name: "Fillment" }),
    })
    const login = await post("/auth/customer/emailpass", { email, password })
    return { token: login.data.token as string }
  }

  async function createCourier() {
    const name = `Courier ${Math.random().toString(36).slice(2, 8)}`
    const email = `courier-${suffix}-${Math.random().toString(36).slice(2, 8)}@example.test`
    const created = await post("/admin/couriers", { name, email }, { token: adminToken })
    const token = created.data.activation_url.split("token=")[1]
    const password = "correct-horse-battery-k"
    await post("/courier-activation/complete", { token, password })
    const login = await post("/auth/courier/emailpass", { email, password })
    return { token: login.data.token as string, id: created.data.courier.id as string }
  }

  /** Runs a full checkout for one seller/customer pair and returns the
   * resulting vendor_order id, ready for the fulfillment lifecycle. */
  async function checkoutOneVendorOrder(sellerToken: string, customerToken: string, variantId: string) {
    await post("/store/cart/items", { variant_id: variantId, quantity: 1 }, { token: customerToken })
    const checkout = await post(
      "/store/checkout",
      { shipping_address: shippingAddress, idempotency_key: `idem-${suffix}-${Math.random()}` },
      { token: customerToken }
    )
    const paymentIntentId = paymentIntentIdFromClientSecret(checkout.data.client_secret)
    await postWebhook(
      {
        id: `evt_${suffix}_${Math.random()}`,
        type: "payment_intent.succeeded",
        data: { object: { id: paymentIntentId } },
      },
      "test-signature"
    )
    const orderDetail = await get(`/store/orders/${checkout.data.order_id}`, { token: customerToken })
    return {
      orderId: checkout.data.order_id as string,
      vendorOrderId: orderDetail.data.order.vendor_orders[0].id as string,
    }
  }

  test("a fulfillment order moves through the full lifecycle: preparing -> ready for pickup -> assigned -> picked up -> out for delivery -> delivered", async () => {
    const seller = await provisionSeller("fulfillment-lifecycle")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()
    const courier = await createCourier()

    const { orderId, vendorOrderId } = await checkoutOneVendorOrder(
      seller.token,
      customer.token,
      product.variantId
    )

    const preparing = await post(
      `/seller/fulfillment-orders/${vendorOrderId}/mark-preparing`,
      undefined,
      { token: seller.token }
    )
    expect(preparing.data.fulfillment_order.status).toBe("preparing")

    const ready = await post(
      `/seller/fulfillment-orders/${vendorOrderId}/mark-ready-for-pickup`,
      undefined,
      { token: seller.token }
    )
    expect(ready.data.fulfillment_order.status).toBe("ready_for_pickup")
    const pickupCode = ready.data.fulfillment_order.pickup_code as string
    expect(pickupCode).toBeTruthy()

    const assign = await post(
      `/admin/fulfillment-orders/${vendorOrderId}/assign-courier`,
      { courier_id: courier.id },
      { token: adminToken }
    )
    expect(assign.data.fulfillment_order.assigned_courier_id).toBe(courier.id)

    const assignmentDetail = await get(`/courier/assignments/${vendorOrderId}`, {
      token: courier.token,
    })
    expect(assignmentDetail.status).toBe(200)
    // Privacy: the courier's view never leaks customer PII or seller identity.
    const serializedAssignment = JSON.stringify(assignmentDetail.data)
    expect(serializedAssignment).not.toContain("customer")
    expect(serializedAssignment).not.toContain(seller.slug)

    const pickedUp = await post(
      `/courier/assignments/${vendorOrderId}/confirm-pickup`,
      { code: pickupCode },
      { token: courier.token }
    )
    expect(pickedUp.data.assignment.status).toBe("picked_up")

    const outForDelivery = await post(
      `/courier/assignments/${vendorOrderId}/start-delivery`,
      undefined,
      { token: courier.token }
    )
    expect(outForDelivery.data.assignment.status).toBe("out_for_delivery")

    const orderBeforeDelivery = await get(`/store/orders/${orderId}`, { token: customer.token })
    const deliveryCode = orderBeforeDelivery.data.order.vendor_orders[0]
      .delivery_confirmation_code as string
    expect(deliveryCode).toBeTruthy()
    // The pickup code must never appear in the customer's own order view.
    expect(JSON.stringify(orderBeforeDelivery.data)).not.toContain(pickupCode)

    const delivered = await post(
      `/courier/assignments/${vendorOrderId}/confirm-delivery`,
      { code: deliveryCode },
      { token: courier.token }
    )
    expect(delivered.data.assignment.status).toBe("delivered")

    const finalOrder = await get(`/store/orders/${orderId}`, { token: customer.token })
    expect(finalOrder.data.order.vendor_orders[0].status).toBe("delivered")
    expect(finalOrder.data.order.vendor_orders[0].timeline.delivered_at).toBeTruthy()
  })

  test("a redeemed pickup code cannot be used again (single-use, replay protection)", async () => {
    const seller = await provisionSeller("fulfillment-replay")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()
    const courier = await createCourier()

    const { vendorOrderId } = await checkoutOneVendorOrder(seller.token, customer.token, product.variantId)

    await post(`/seller/fulfillment-orders/${vendorOrderId}/mark-preparing`, undefined, {
      token: seller.token,
    })
    const ready = await post(
      `/seller/fulfillment-orders/${vendorOrderId}/mark-ready-for-pickup`,
      undefined,
      { token: seller.token }
    )
    const pickupCode = ready.data.fulfillment_order.pickup_code as string

    await post(
      `/admin/fulfillment-orders/${vendorOrderId}/assign-courier`,
      { courier_id: courier.id },
      { token: adminToken }
    )

    const first = await post(
      `/courier/assignments/${vendorOrderId}/confirm-pickup`,
      { code: pickupCode },
      { token: courier.token }
    )
    expect(first.status).toBe(200)

    const replay = await post(
      `/courier/assignments/${vendorOrderId}/confirm-pickup`,
      { code: pickupCode },
      { token: courier.token }
    )
    expect(replay.status).toBe(422)
  })

  test("the seller's fulfillment view never includes customer identity or private fields", async () => {
    const seller = await provisionSeller("fulfillment-privacy")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    await checkoutOneVendorOrder(seller.token, customer.token, product.variantId)

    const list = await get("/seller/fulfillment-orders", { token: seller.token })
    const serialized = JSON.stringify(list.data)
    expect(serialized).not.toContain("customer_id")
    expect(serialized).not.toContain("shipping_address")
    expect(serialized).not.toContain(shippingAddress.phone)
  })

  test("a courier cannot access an assignment belonging to a different courier", async () => {
    const seller = await provisionSeller("fulfillment-courier-scope")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()
    const courierA = await createCourier()
    const courierB = await createCourier()

    const { vendorOrderId } = await checkoutOneVendorOrder(seller.token, customer.token, product.variantId)
    await post(`/seller/fulfillment-orders/${vendorOrderId}/mark-preparing`, undefined, {
      token: seller.token,
    })
    await post(`/seller/fulfillment-orders/${vendorOrderId}/mark-ready-for-pickup`, undefined, {
      token: seller.token,
    })
    await post(
      `/admin/fulfillment-orders/${vendorOrderId}/assign-courier`,
      { courier_id: courierA.id },
      { token: adminToken }
    )

    const asOwner = await get(`/courier/assignments/${vendorOrderId}`, { token: courierA.token })
    expect(asOwner.status).toBe(200)

    const asOther = await get(`/courier/assignments/${vendorOrderId}`, { token: courierB.token })
    expect(asOther.status).toBe(404)
  })

  test("reading an assignment's detail is audit-logged", async () => {
    const seller = await provisionSeller("fulfillment-audit")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()
    const courier = await createCourier()

    const { vendorOrderId } = await checkoutOneVendorOrder(seller.token, customer.token, product.variantId)
    await post(`/seller/fulfillment-orders/${vendorOrderId}/mark-preparing`, undefined, {
      token: seller.token,
    })
    await post(`/seller/fulfillment-orders/${vendorOrderId}/mark-ready-for-pickup`, undefined, {
      token: seller.token,
    })
    await post(
      `/admin/fulfillment-orders/${vendorOrderId}/assign-courier`,
      { courier_id: courier.id },
      { token: adminToken }
    )

    await get(`/courier/assignments/${vendorOrderId}`, { token: courier.token })

    const { rows } = await dbClient.query(
      `SELECT * FROM audit_log WHERE entity_id = $1 AND action = 'vendor_order.assignment_viewed'`,
      [vendorOrderId]
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].actor_type).toBe("courier")
    expect(rows[0].actor_id).toBe(courier.id)
  })
})
