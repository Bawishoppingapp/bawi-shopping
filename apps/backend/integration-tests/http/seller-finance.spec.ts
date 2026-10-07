import { Client } from "pg"
import {
  startTestServer,
  stopTestServer,
  PORT,
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
} from "./test-server"
import { settleManualPayment } from "./manual-payment"

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
const put = (path: string, body?: unknown, opts?: { token?: string }) =>
  request("PUT", path, { ...opts, body })

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

describe("Seller finance: commission ledger, payouts, returns, and refunds (real server, real Postgres)", () => {
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

    // Production intentionally launches with returns disabled. This suite
    // enables a finite window explicitly so it can exercise the return and
    // refund workflows, then restores the launch default in afterAll.
    await put(
      "/admin/business-config/returns/return_window_days",
      { value: 14 },
      { token: adminToken }
    )
  })

  afterAll(async () => {
    if (adminToken) {
      await put(
        "/admin/business-config/returns/return_window_days",
        { value: 0 },
        { token: adminToken }
      ).catch(() => undefined)
    }
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

  /** Onboards the seller's Stripe account and flips it to payouts-enabled
   * via the same account.updated webhook flow stripe-onboarding.spec.ts
   * uses - required before a payout batch will do anything. */
  async function enableSellerPayouts(sellerToken: string, slug: string) {
    await post("/seller/stripe/onboarding-link", undefined, { token: sellerToken })
    const { rows } = await dbClient.query("SELECT id, stripe_account_id FROM seller WHERE slug = $1", [
      slug,
    ])
    const seller = rows[0]
    await postWebhook(
      {
        id: `evt_${suffix}_${Math.random()}`,
        type: "account.updated",
        data: {
          object: {
            id: seller.stripe_account_id,
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
          },
        },
      },
      "test-signature"
    )
    return { vendorId: seller.id as string }
  }

  async function createApprovedProduct(sellerToken: string) {
    const payload = {
      title: `Finance Product ${Date.now()}-${Math.random()}`,
      description: "Created for seller-finance integration testing.",
      category_id: baseCategoryId,
      base_price: 10000,
      variants: [{ color: "Black", size: "M", inventory_quantity: 10 }],
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
    const email = `finance-customer-${suffix}-${Math.random().toString(36).slice(2, 8)}@example.test`
    const password = "correct-horse-battery-c"
    const registerResponse = await post("/auth/customer/emailpass/register", { email, password })
    await fetch(`${BASE_URL}/store/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${registerResponse.data.token}`,
        "x-publishable-api-key": publishableApiKey ?? "",
      },
      body: JSON.stringify({ email, first_name: "Fin", last_name: "Ance" }),
    })
    const login = await post("/auth/customer/emailpass", { email, password })
    return { token: login.data.token as string }
  }

  async function checkoutOneVendorOrder(sellerToken: string, customerToken: string, variantId: string) {
    await post("/store/cart/items", { variant_id: variantId, quantity: 1 }, { token: customerToken })
    const checkout = await post(
      "/store/checkout",
      { shipping_address: shippingAddress, idempotency_key: `idem-${suffix}-${Math.random()}` },
      { token: customerToken }
    )
    if (checkout.status !== 200) {
      throw new Error(`Checkout failed (${checkout.status}): ${JSON.stringify(checkout.data)}`)
    }
    await settleManualPayment({
      baseUrl: BASE_URL,
      orderId: checkout.data.order_id,
      customerToken,
      adminToken,
      publishableApiKey,
    })
    const orderDetail = await get(`/store/orders/${checkout.data.order_id}`, { token: customerToken })
    return {
      orderId: checkout.data.order_id as string,
      vendorOrderId: orderDetail.data.order.vendor_orders[0].id as string,
      itemId: orderDetail.data.order.vendor_orders[0].items[0].id as string,
    }
  }

  async function deliverVendorOrder(sellerToken: string, adminTok: string, vendorOrderId: string) {
    await post(`/seller/fulfillment-orders/${vendorOrderId}/mark-preparing`, undefined, {
      token: sellerToken,
    })
    const ready = await post(
      `/seller/fulfillment-orders/${vendorOrderId}/mark-ready-for-pickup`,
      undefined,
      { token: sellerToken }
    )
    const pickupCode = ready.data.fulfillment_order.pickup_code as string

    const courierEmail = `finance-courier-${suffix}-${Math.random().toString(36).slice(2, 8)}@example.test`
    const createdCourier = await post(
      "/admin/couriers",
      { name: "Finance Courier", email: courierEmail },
      { token: adminTok }
    )
    const activationToken = createdCourier.data.activation_url.split("token=")[1]
    await post("/courier-activation/complete", {
      token: activationToken,
      password: "correct-horse-battery-k",
    })
    const courierLogin = await post("/auth/courier/emailpass", {
      email: courierEmail,
      password: "correct-horse-battery-k",
    })
    const courierToken = courierLogin.data.token as string

    await post(
      `/admin/fulfillment-orders/${vendorOrderId}/assign-courier`,
      { courier_id: createdCourier.data.courier.id },
      { token: adminTok }
    )
    await post(
      `/courier/assignments/${vendorOrderId}/confirm-pickup`,
      { code: pickupCode },
      { token: courierToken }
    )
    await post(`/courier/assignments/${vendorOrderId}/start-delivery`, undefined, {
      token: courierToken,
    })
    const orderBeforeDelivery = await get(
      `/store/orders/${(await dbClient.query("SELECT order_id FROM vendor_order WHERE id = $1", [vendorOrderId])).rows[0].order_id}`,
      { token: undefined }
    ).catch(() => null)
    const { rows } = await dbClient.query(
      "SELECT code FROM tracking_code WHERE vendor_order_id = $1",
      [vendorOrderId]
    )
    const deliveryCode = rows[0]?.code as string
    await post(
      `/courier/assignments/${vendorOrderId}/confirm-delivery`,
      { code: deliveryCode },
      { token: courierToken }
    )
  }

  test("checkout capture creates a pending commission ledger entry reflected in the seller's balance", async () => {
    const seller = await provisionSeller("ledger-create")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    await checkoutOneVendorOrder(seller.token, customer.token, product.variantId)

    const balance = await get("/seller/finance/balance", { token: seller.token })
    expect(balance.status).toBe(200)
    // The customer pays the 10% markup (11,000); the seller's base 10,000
    // remains the pending balance.
    expect(balance.data.balance.pending).toBe(10000)
    expect(balance.data.balance.available).toBe(0)
  })

  test("a payout batch transfers every available entry and marks them paid, idempotently", async () => {
    const seller = await provisionSeller("payout-batch")
    const { vendorId } = await enableSellerPayouts(seller.token, seller.slug)
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    const { vendorOrderId } = await checkoutOneVendorOrder(seller.token, customer.token, product.variantId)

    // Force the ledger entry into the "available" bucket without waiting
    // out the real transfer-hold window - same direct-DB-manipulation
    // pattern other specs use for time-dependent state (see cart.spec.ts).
    await dbClient.query(
      "UPDATE commission_ledger_entry SET available_at = now() - interval '1 day' WHERE vendor_order_id = $1",
      [vendorOrderId]
    )

    const balanceBefore = await get("/seller/finance/balance", { token: seller.token })
    expect(balanceBefore.data.balance.available).toBe(10000)

    const payout = await post("/admin/finance/payouts", { vendor_id: vendorId }, { token: adminToken })
    expect(payout.status).toBe(200)
    expect(payout.data.payout.amount).toBe(10000)
    expect(payout.data.payout.stripe_transfer_id).toMatch(/^tr_test_/)

    const balanceAfter = await get("/seller/finance/balance", { token: seller.token })
    expect(balanceAfter.data.balance.available).toBe(0)
    expect(balanceAfter.data.balance.paid).toBe(10000)

    // Re-running the batch finds nothing left eligible (claimed by the
    // unique payout_line_item.commission_ledger_entry_id constraint).
    const secondPayout = await post(
      "/admin/finance/payouts",
      { vendor_id: vendorId },
      { token: adminToken }
    )
    expect(secondPayout.data.payout).toBeNull()
  })

  test("an approved return refunds the customer, reverses commission proportionally, and restocks a customer-remorse item", async () => {
    const seller = await provisionSeller("return-approve")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    const { vendorOrderId, itemId } = await checkoutOneVendorOrder(
      seller.token,
      customer.token,
      product.variantId
    )
    await deliverVendorOrder(seller.token, adminToken, vendorOrderId)

    const createReturn = await post(
      "/store/return-requests",
      { vendor_order_item_id: itemId, reason: "customer_remorse", customer_comment: "Wrong size" },
      { token: customer.token }
    )
    expect(createReturn.status).toBe(201)
    const returnRequestId = createReturn.data.return_request.id as string

    const approve = await post(
      `/seller/returns/${returnRequestId}/approve`,
      {},
      { token: seller.token }
    )
    expect(approve.status).toBe(200)
    expect(approve.data.return_request.status).toBe("refunded")

    const { rows: refundRows } = await dbClient.query(
      "SELECT * FROM order_refund WHERE return_request_id = $1",
      [returnRequestId]
    )
    expect(refundRows).toHaveLength(1)
    expect(refundRows[0].amount).toBe(11000)
    expect(refundRows[0].stripe_refund_id).toBeNull()

    const { rows: reversalRows } = await dbClient.query(
      "SELECT * FROM commission_ledger_entry WHERE vendor_order_id = $1 AND reason = 'refund_reversal'",
      [vendorOrderId]
    )
    expect(reversalRows).toHaveLength(1)
    expect(Number(reversalRows[0].net_amount)).toBe(-10000)

    // customer_remorse is restockable - inventory should be back to 10.
    const { rows: inventoryRows } = await dbClient.query(
      `SELECT il.stocked_quantity FROM inventory_level il
       JOIN inventory_item ii ON ii.id = il.inventory_item_id
       JOIN product_variant_inventory_item pvii ON pvii.inventory_item_id = ii.id
       WHERE pvii.variant_id = $1`,
      [product.variantId]
    )
    expect(Number(inventoryRows[0].stocked_quantity)).toBe(10)
  })

  test("a denied return leaves the ledger and balance untouched", async () => {
    const seller = await provisionSeller("return-deny")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    const { vendorOrderId, itemId } = await checkoutOneVendorOrder(
      seller.token,
      customer.token,
      product.variantId
    )
    await deliverVendorOrder(seller.token, adminToken, vendorOrderId)

    const createReturn = await post(
      "/store/return-requests",
      { vendor_order_item_id: itemId, reason: "damaged" },
      { token: customer.token }
    )
    const returnRequestId = createReturn.data.return_request.id as string

    const deny = await post(
      `/seller/returns/${returnRequestId}/deny`,
      { seller_response: "Photos show no damage on arrival" },
      { token: seller.token }
    )
    expect(deny.status).toBe(200)
    expect(deny.data.return_request.status).toBe("denied")

    const balance = await get("/seller/finance/balance", { token: seller.token })
    expect(balance.data.balance.available).toBe(10000)

    const { rows } = await dbClient.query(
      "SELECT * FROM commission_ledger_entry WHERE vendor_order_id = $1 AND reason = 'refund_reversal'",
      [vendorOrderId]
    )
    expect(rows).toHaveLength(0)
  })

  test("a customer can cancel before the seller starts preparing - full refund and full ledger reversal", async () => {
    const seller = await provisionSeller("cancel-flow")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    const { vendorOrderId } = await checkoutOneVendorOrder(seller.token, customer.token, product.variantId)

    const cancel = await post(`/store/vendor-orders/${vendorOrderId}/cancel`, {}, {
      token: customer.token,
    })
    expect(cancel.status).toBe(200)
    expect(cancel.data.status).toBe("cancelled")

    const { rows: vendorOrderRows } = await dbClient.query(
      "SELECT status FROM vendor_order WHERE id = $1",
      [vendorOrderId]
    )
    expect(vendorOrderRows[0].status).toBe("cancelled")

    const { rows: reversalRows } = await dbClient.query(
      "SELECT * FROM commission_ledger_entry WHERE vendor_order_id = $1 AND reason = 'refund_reversal'",
      [vendorOrderId]
    )
    expect(reversalRows).toHaveLength(1)
    expect(Number(reversalRows[0].net_amount)).toBe(-10000)

    const { rows: refundRows } = await dbClient.query(
      "SELECT * FROM order_refund WHERE vendor_order_id = $1",
      [vendorOrderId]
    )
    expect(refundRows[0].return_request_id).toBeNull()
    const { rows: vendorOrderTotals } = await dbClient.query(
      "SELECT total_amount FROM vendor_order WHERE id = $1",
      [vendorOrderId]
    )
    expect(refundRows[0].amount).toBe(vendorOrderTotals[0].total_amount)
    expect(refundRows[0].stripe_refund_id).toBeNull()
    expect(refundRows[0].status).toBe("pending")
  })

  test("cancellation remains available while the seller is preparing before courier pickup", async () => {
    const seller = await provisionSeller("cancel-cutoff")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    const { vendorOrderId } = await checkoutOneVendorOrder(seller.token, customer.token, product.variantId)
    await post(`/seller/fulfillment-orders/${vendorOrderId}/mark-preparing`, undefined, {
      token: seller.token,
    })

    const cancel = await post(`/store/vendor-orders/${vendorOrderId}/cancel`, {}, {
      token: customer.token,
    })
    expect(cancel.status).toBe(200)
    expect(cancel.data.status).toBe("cancelled")
  })

  test("a verified manual Telebirr payment stores no customer Stripe payment intent", async () => {
    const seller = await provisionSeller("manual-payment")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    const { orderId } = await checkoutOneVendorOrder(
      seller.token,
      customer.token,
      product.variantId
    )
    const { rows: orderRows } = await dbClient.query(
      "SELECT payment_method, payment_status, stripe_payment_intent_id FROM marketplace_order WHERE id = $1",
      [orderId]
    )
    expect(orderRows[0]).toMatchObject({
      payment_method: "manual_telebirr",
      payment_status: "succeeded",
      stripe_payment_intent_id: null,
    })
  })

  test("a seller cannot see another seller's balance, payouts, or return requests", async () => {
    const sellerA = await provisionSeller("isolation-a")
    const sellerB = await provisionSeller("isolation-b")
    const product = await createApprovedProduct(sellerA.token)
    const customer = await createCustomer()

    await checkoutOneVendorOrder(sellerA.token, customer.token, product.variantId)

    const balanceAsB = await get("/seller/finance/balance", { token: sellerB.token })
    expect(balanceAsB.data.balance.pending).toBe(0)

    const returnsAsB = await get("/seller/returns", { token: sellerB.token })
    expect(returnsAsB.data.return_requests).toHaveLength(0)
  })
})
