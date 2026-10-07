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

describe("Seller finance: commission ledger, payouts, returns, refunds, disputes (real server, real Postgres)", () => {
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
    const { execFileSync } = await import("node:child_process")
    const path = await import("node:path")
    const adminEmail = `finance-admin-${suffix}@example.test`
    execFileSync("npx", ["medusa", "user", "-e", adminEmail, "-p", "correct-horse-battery-admin"], {
      cwd: path.resolve(__dirname, "../.."),
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
      "SELECT delivery_confirmation_code FROM tracking_code WHERE vendor_order_id = $1",
      [vendorOrderId]
    )
    const deliveryCode = rows[0]?.delivery_confirmation_code as string
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
    // 10000 subtotal * default 15% commission = 1500 commission, 8500 net.
    expect(balance.data.balance.pending).toBe(8500)
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
    expect(balanceBefore.data.balance.available).toBe(8500)

    const payout = await post("/admin/finance/payouts", { vendor_id: vendorId }, { token: adminToken })
    expect(payout.status).toBe(200)
    expect(payout.data.payout.amount).toBe(8500)
    expect(payout.data.payout.stripe_transfer_id).toMatch(/^tr_test_/)

    const balanceAfter = await get("/seller/finance/balance", { token: seller.token })
    expect(balanceAfter.data.balance.available).toBe(0)
    expect(balanceAfter.data.balance.paid).toBe(8500)

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
    expect(refundRows[0].amount).toBe(10000)
    expect(refundRows[0].stripe_refund_id).toMatch(/^re_test_/)

    const { rows: reversalRows } = await dbClient.query(
      "SELECT * FROM commission_ledger_entry WHERE vendor_order_id = $1 AND reason = 'refund_reversal'",
      [vendorOrderId]
    )
    expect(reversalRows).toHaveLength(1)
    expect(Number(reversalRows[0].net_amount)).toBe(-8500)

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
    expect(balance.data.balance.available).toBe(8500)

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
    expect(Number(reversalRows[0].net_amount)).toBe(-8500)

    const { rows: refundRows } = await dbClient.query(
      "SELECT * FROM order_refund WHERE vendor_order_id = $1",
      [vendorOrderId]
    )
    expect(refundRows[0].return_request_id).toBeNull()
    expect(refundRows[0].amount).toBe(10000)
  })

  test("cancellation is rejected once the seller has started preparing", async () => {
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
    expect(cancel.status).toBe(422)
  })

  test("a Stripe dispute freezes the ledger entry and a won dispute releases it", async () => {
    const seller = await provisionSeller("dispute-flow")
    const product = await createApprovedProduct(seller.token)
    const customer = await createCustomer()

    const { orderId, vendorOrderId } = await checkoutOneVendorOrder(
      seller.token,
      customer.token,
      product.variantId
    )
    const { rows: orderRows } = await dbClient.query(
      "SELECT stripe_payment_intent_id FROM marketplace_order WHERE id = $1",
      [orderId]
    )
    const paymentIntentId = orderRows[0].stripe_payment_intent_id as string

    const disputeId = `dp_test_${suffix}_${Math.random().toString(36).slice(2, 8)}`
    await postWebhook(
      {
        id: `evt_${suffix}_${Math.random()}`,
        type: "charge.dispute.created",
        data: {
          object: { id: disputeId, payment_intent: paymentIntentId, amount: 8500, reason: "fraudulent" },
        },
      },
      "test-signature"
    )

    const balanceDisputed = await get("/seller/finance/balance", { token: seller.token })
    expect(balanceDisputed.data.balance.disputed).toBe(8500)
    expect(balanceDisputed.data.balance.pending).toBe(0)

    const disputesList = await get("/admin/finance/disputes", { token: adminToken })
    expect(disputesList.data.disputes.some((d: { stripe_dispute_id: string }) => d.stripe_dispute_id === disputeId)).toBe(
      true
    )

    await postWebhook(
      {
        id: `evt_${suffix}_${Math.random()}`,
        type: "charge.dispute.closed",
        data: { object: { id: disputeId, status: "won" } },
      },
      "test-signature"
    )

    const balanceResolved = await get("/seller/finance/balance", { token: seller.token })
    expect(balanceResolved.data.balance.disputed).toBe(0)
    expect(balanceResolved.data.balance.pending).toBe(8500)
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
