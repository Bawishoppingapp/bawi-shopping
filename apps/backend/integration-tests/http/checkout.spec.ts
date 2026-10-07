import { Client } from "pg"
import {
  startTestServer,
  stopTestServer,
  PORT,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
} from "./test-server"
import {
  approveManualPayment,
  settleManualPayment,
  submitManualPaymentProof,
} from "./manual-payment"

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

describe("Checkout and multi-vendor order splitting (real server, real Postgres)", () => {
  let serverProcess: Awaited<ReturnType<typeof startTestServer>>
  let dbClient: Client
  let baseCategoryId: string
  let adminToken: string

  const suffix = Date.now()

  const shippingAddress = {
    first_name: "Ada",
    last_name: "Lovelace",
    address_1: "123 Bole Road",
    city: "Addis Ababa",
    sub_city: "Bole",
    country_code: "ET",
    phone: "+251911123456",
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

    const adminLogin = await post("/auth/user/emailpass", {
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
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

  async function createApprovedProduct(
    sellerToken: string,
    overrides: Record<string, unknown> = {}
  ) {
    const payload = {
      title: `Checkout Product ${Date.now()}-${Math.random()}`,
      description: "Created for checkout integration testing.",
      category_id: baseCategoryId,
      base_price: 5000,
      variants: [{ color: "Blue", size: "M", inventory_quantity: 10 }],
      ...overrides,
    }
    const created = await post("/seller/products", payload, { token: sellerToken })
    await post(`/seller/products/${created.data.listing.id}/submit`, undefined, {
      token: sellerToken,
    })
    await post(`/admin/product-listings/${created.data.listing.id}/approve`, undefined, {
      token: adminToken,
    })
    const detail = await get(`/seller/products/${created.data.listing.id}`, { token: sellerToken })
    return {
      productCode: created.data.listing.product_code as string,
      variantId: detail.data.product.variants[0].id as string,
    }
  }

  async function createCustomer() {
    const email = `checkout-customer-${suffix}-${Math.random().toString(36).slice(2, 8)}@example.test`
    const password = "correct-horse-battery-c"
    const registerResponse = await post("/auth/customer/emailpass/register", { email, password })
    await fetch(`${BASE_URL}/store/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${registerResponse.data.token}`,
        "x-publishable-api-key": publishableApiKey ?? "",
      },
      body: JSON.stringify({ email, first_name: "Check", last_name: "Out" }),
    })
    const login = await post("/auth/customer/emailpass", { email, password })
    return { token: login.data.token as string, email }
  }

  async function availableQuantity(productCode: string, variantId: string): Promise<number> {
    const response = await get(`/products/${productCode}`)
    const variant = response.data.product.variants.find((v: { id: string }) => v.id === variantId)
    return variant.available_quantity
  }

  test("a multi-vendor checkout splits into one vendor order per seller, decrements inventory, and clears the cart", async () => {
    const sellerA = await provisionSeller("checkout-vendor-a")
    const sellerB = await provisionSeller("checkout-vendor-b")
    const productA = await createApprovedProduct(sellerA.token)
    const productB = await createApprovedProduct(sellerB.token, {
      variants: [{ color: "Red", size: "L", inventory_quantity: 10 }],
    })
    const customer = await createCustomer()

    await post("/store/cart/items", { variant_id: productA.variantId, quantity: 1 }, { token: customer.token })
    await post("/store/cart/items", { variant_id: productB.variantId, quantity: 2 }, { token: customer.token })

    const checkout = await post(
      "/store/checkout",
      { shipping_address: shippingAddress, idempotency_key: `idem-${suffix}-multi` },
      { token: customer.token }
    )
    expect(checkout.status).toBe(200)
    expect(checkout.data.payment_method).toBe("manual_telebirr")
    expect(checkout.data.payment_recipient_phone).toBeTruthy()
    const orderId = checkout.data.order_id as string

    await settleManualPayment({
      baseUrl: BASE_URL,
      orderId,
      customerToken: customer.token,
      adminToken,
      publishableApiKey,
    })

    const orderDetail = await get(`/store/orders/${orderId}`, { token: customer.token })
    expect(orderDetail.data.order.status).toBe("paid")
    expect(orderDetail.data.order.vendor_orders).toHaveLength(2)

    const vendorSubtotalSum = orderDetail.data.order.vendor_orders.reduce(
      (sum: number, vo: { subtotal: number }) => sum + vo.subtotal,
      0
    )
    expect(vendorSubtotalSum).toBe(orderDetail.data.order.subtotal)

    // Privacy: no seller identity leaks through, only the resolved brand.
    const serialized = JSON.stringify(orderDetail.data.order)
    expect(serialized).not.toContain("vendor_id")
    for (const vendorOrder of orderDetail.data.order.vendor_orders) {
      expect(vendorOrder.brand).toBe("Bawi Shopping Seller")
    }

    expect(await availableQuantity(productA.productCode, productA.variantId)).toBe(9)
    expect(await availableQuantity(productB.productCode, productB.variantId)).toBe(8)

    const cart = await get("/store/cart", { token: customer.token })
    expect(cart.data.cart.items).toHaveLength(0)
  })

  test("a repeated manual-payment approval does not create duplicate vendor orders", async () => {
    const seller = await provisionSeller("checkout-idempotent-payment")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    await post("/store/cart/items", { variant_id: product.variantId, quantity: 1 }, { token: customer.token })
    const checkout = await post(
      "/store/checkout",
      { shipping_address: shippingAddress, idempotency_key: `idem-${suffix}-dup-webhook` },
      { token: customer.token }
    )
    const orderId = checkout.data.order_id as string
    await submitManualPaymentProof({
      baseUrl: BASE_URL,
      orderId,
      customerToken: customer.token,
      publishableApiKey,
    })
    await approveManualPayment({ baseUrl: BASE_URL, orderId, adminToken })
    const repeatedApproval = await post(
      `/admin/payments/${orderId}/approve`,
      undefined,
      { token: adminToken }
    )
    expect(repeatedApproval.status).toBe(409)

    const orderDetail = await get(`/store/orders/${orderId}`, { token: customer.token })
    expect(orderDetail.data.order.vendor_orders).toHaveLength(1)
    expect(await availableQuantity(product.productCode, product.variantId)).toBe(9)
  })

  test("starting checkout twice with the same idempotency_key returns the same order", async () => {
    const seller = await provisionSeller("checkout-idempotent-start")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    await post("/store/cart/items", { variant_id: product.variantId, quantity: 1 }, { token: customer.token })
    const idempotencyKey = `idem-${suffix}-dup-start`

    const first = await post(
      "/store/checkout",
      { shipping_address: shippingAddress, idempotency_key: idempotencyKey },
      { token: customer.token }
    )
    const second = await post(
      "/store/checkout",
      { shipping_address: shippingAddress, idempotency_key: idempotencyKey },
      { token: customer.token }
    )

    expect(second.data.order_id).toBe(first.data.order_id)
  })

  test("checkout requires authentication", async () => {
    const response = await post("/store/checkout", {
      shipping_address: shippingAddress,
      idempotency_key: `idem-${suffix}-unauth`,
    })
    expect(response.status).toBe(401)
  })

  test("a customer cannot read another customer's order", async () => {
    const seller = await provisionSeller("checkout-privacy")
    const product = await createApprovedProduct(seller.token)
    const customerA = await createCustomer()
    const customerB = await createCustomer()

    await post("/store/cart/items", { variant_id: product.variantId, quantity: 1 }, { token: customerA.token })
    const checkout = await post(
      "/store/checkout",
      { shipping_address: shippingAddress, idempotency_key: `idem-${suffix}-privacy` },
      { token: customerA.token }
    )

    const asOwner = await get(`/store/orders/${checkout.data.order_id}`, { token: customerA.token })
    expect(asOwner.status).toBe(200)

    const asOther = await get(`/store/orders/${checkout.data.order_id}`, { token: customerB.token })
    expect(asOther.status).toBe(404)
  })

  test("a rejected manual-payment proof keeps the reservation and cart available for resubmission", async () => {
    const seller = await provisionSeller("checkout-payment-rejected")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    await post("/store/cart/items", { variant_id: product.variantId, quantity: 1 }, { token: customer.token })
    const checkout = await post(
      "/store/checkout",
      { shipping_address: shippingAddress, idempotency_key: `idem-${suffix}-failed` },
      { token: customer.token }
    )
    expect(await availableQuantity(product.productCode, product.variantId)).toBe(9)

    const orderId = checkout.data.order_id as string
    await submitManualPaymentProof({
      baseUrl: BASE_URL,
      orderId,
      customerToken: customer.token,
      publishableApiKey,
    })
    const rejected = await post(
      `/admin/payments/${orderId}/reject`,
      { reason: "The receipt could not be verified." },
      { token: adminToken }
    )
    expect(rejected.status).toBe(200)
    expect(rejected.data.payment_status).toBe("rejected")

    expect(await availableQuantity(product.productCode, product.variantId)).toBe(9)

    const cart = await get("/store/cart", { token: customer.token })
    expect(cart.data.cart.items).toHaveLength(1)
  })
})
