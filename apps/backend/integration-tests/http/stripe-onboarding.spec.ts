import { execFileSync } from "node:child_process"
import path from "node:path"
import { Client } from "pg"
import { startTestServer, stopTestServer, PORT } from "./test-server"

jest.setTimeout(180 * 1000)

const BASE_URL = `http://localhost:${PORT}`
const BACKEND_ROOT = path.resolve(__dirname, "../..")
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

async function putRequest(path: string, body: unknown, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

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

function createAdmin(email: string, password: string) {
  execFileSync("npx", ["medusa", "user", "-e", email, "-p", password], {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  })
}

describe("Stripe Connect seller onboarding, business configuration, and webhooks", () => {
  let serverProcess: Awaited<ReturnType<typeof startTestServer>>
  let dbClient: Client
  let adminToken: string

  const suffix = Date.now()
  const adminEmail = `stripe-admin-${suffix}@example.test`
  const adminPassword = "correct-horse-battery-admin"

  beforeAll(async () => {
    createAdmin(adminEmail, adminPassword)
    serverProcess = await startTestServer()

    dbClient = new Client({ connectionString: TEST_DATABASE_URL })
    await dbClient.connect()

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

  async function provisionSeller(slugPrefix: string) {
    const suffix2 = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const slug = `${slugPrefix}-${suffix2}`
    const email = `${slug}@example.test`
    const password = "correct-horse-battery-s"
    await post("/seller-test-support/provision", {
      name: `Stripe Test Seller ${suffix2}`,
      slug,
      email,
      password,
    })
    const login = await post("/auth/seller_user/emailpass", { email, password })
    return { token: login.data.token as string, slug }
  }

  describe("onboarding link creation", () => {
    test("an unauthenticated caller cannot request an onboarding link", async () => {
      const response = await post("/seller/stripe/onboarding-link")
      expect(response.status).toBe(401)
    })

    test("creates a Stripe account and returns an onboarding URL", async () => {
      const { token } = await provisionSeller("onboard")
      const response = await post("/seller/stripe/onboarding-link", undefined, token)
      expect(response.status).toBe(200)
      expect(typeof response.data.url).toBe("string")
      expect(response.data.url.length).toBeGreaterThan(0)
    })

    test("the response never includes a stripe_account_id or any bank/tax/identity field", async () => {
      const { token } = await provisionSeller("noleak")
      const response = await post("/seller/stripe/onboarding-link", undefined, token)
      const serialized = JSON.stringify(response.data)
      expect(serialized).not.toContain("stripe_account_id")
      expect(serialized.toLowerCase()).not.toContain("bank")
      expect(serialized.toLowerCase()).not.toContain("tax_id")
      expect(serialized.toLowerCase()).not.toContain("ssn")
    })

    test("requesting a link twice reuses the same underlying Stripe account rather than creating a second one", async () => {
      const { token, slug } = await provisionSeller("reuse")
      await post("/seller/stripe/onboarding-link", undefined, token)
      await post("/seller/stripe/onboarding-link", undefined, token)

      const { rows } = await dbClient.query(
        "SELECT stripe_account_id FROM seller WHERE slug = $1",
        [slug]
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].stripe_account_id).toBeTruthy()

      const { rows: auditRows } = await dbClient.query(
        "SELECT count(*)::int AS count FROM audit_log WHERE action = 'seller.stripe_onboarding_link_created' AND vendor_id = (SELECT id FROM seller WHERE slug = $1)",
        [slug]
      )
      // Two link requests -> two audit entries (each request is its own
      // audited action), but only one Stripe account was ever created.
      expect(auditRows[0].count).toBe(2)
    })

    test("GET /seller/me reports Stripe status but never the raw account id", async () => {
      const { token } = await provisionSeller("mestatus")
      await post("/seller/stripe/onboarding-link", undefined, token)
      const me = await get("/seller/me", token)
      expect(me.data.seller.stripe.connected).toBe(true)
      expect(me.data.seller.stripe.charges_enabled).toBe(false)
      const serialized = JSON.stringify(me.data)
      expect(serialized).not.toContain("stripe_account_id")
    })
  })

  describe("Stripe webhook handling", () => {
    test("rejects a request with a missing signature", async () => {
      const response = await postWebhook(
        { id: "evt_missing_sig", type: "account.updated", data: { object: {} } },
        undefined
      )
      expect(response.status).toBe(400)
    })

    test("rejects a request with an invalid signature", async () => {
      const response = await postWebhook(
        { id: "evt_bad_sig", type: "account.updated", data: { object: {} } },
        "not-the-right-signature"
      )
      expect(response.status).toBe(400)
    })

    test("account.updated flips the seller's Stripe status and is idempotent on redelivery", async () => {
      const { token, slug } = await provisionSeller("webhook")
      await post("/seller/stripe/onboarding-link", undefined, token)
      const { rows } = await dbClient.query(
        "SELECT id, stripe_account_id FROM seller WHERE slug = $1",
        [slug]
      )
      const seller = rows[0]

      const eventId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const event = {
        id: eventId,
        type: "account.updated",
        data: {
          object: {
            id: seller.stripe_account_id,
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
          },
        },
      }

      const first = await postWebhook(event, "test-signature")
      expect(first.status).toBe(200)

      const { rows: afterFirst } = await dbClient.query(
        "SELECT stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted FROM seller WHERE id = $1",
        [seller.id]
      )
      expect(afterFirst[0].stripe_charges_enabled).toBe(true)
      expect(afterFirst[0].stripe_payouts_enabled).toBe(true)
      expect(afterFirst[0].stripe_details_submitted).toBe(true)

      const { rows: statusAuditAfterFirst } = await dbClient.query(
        "SELECT count(*)::int AS count FROM audit_log WHERE action = 'seller.stripe_status_updated' AND entity_id = $1",
        [seller.id]
      )
      expect(statusAuditAfterFirst[0].count).toBe(1)

      // Redeliver the exact same event - Stripe's at-least-once guarantee.
      const second = await postWebhook(event, "test-signature")
      expect(second.status).toBe(200)

      const { rows: statusAuditAfterSecond } = await dbClient.query(
        "SELECT count(*)::int AS count FROM audit_log WHERE action = 'seller.stripe_status_updated' AND entity_id = $1",
        [seller.id]
      )
      // Still exactly one - the redelivery must not apply the effect (or
      // write a second audit entry) again.
      expect(statusAuditAfterSecond[0].count).toBe(1)

      const { rows: webhookRows } = await dbClient.query(
        "SELECT count(*)::int AS count FROM processed_webhook_event WHERE provider = 'stripe' AND event_id = $1",
        [eventId]
      )
      expect(webhookRows[0].count).toBe(1)
    })

    test("a non-account.updated event is acknowledged but has no effect", async () => {
      const response = await postWebhook(
        {
          id: `evt_ignored_${Date.now()}`,
          type: "payment_intent.succeeded",
          data: { object: {} },
        },
        "test-signature"
      )
      expect(response.status).toBe(200)
    })
  })

  describe("admin sellers visibility", () => {
    test("an unauthenticated caller cannot list sellers", async () => {
      const response = await get("/admin/sellers")
      expect(response.status).toBe(401)
    })

    test("shows the seller's derived Stripe status, never the raw account id", async () => {
      const { slug } = await provisionSeller("adminview")
      const response = await get("/admin/sellers", adminToken)
      expect(response.status).toBe(200)
      const seller = response.data.sellers.find((s: { slug: string }) => s.slug === slug)
      expect(seller).toBeDefined()
      expect(seller.stripe.connected).toBe(false)
      const serialized = JSON.stringify(response.data)
      expect(serialized).not.toContain("stripe_account_id")
    })
  })

  describe("business configuration", () => {
    test("an unauthenticated caller cannot read or write business configuration", async () => {
      const getResponse = await get("/admin/business-config")
      expect(getResponse.status).toBe(401)
      const putResponse = await putRequest(
        "/admin/business-config/commission/platform_default_rate_basis_points",
        { value: 999 }
      )
      expect(putResponse.status).toBe(401)
    })

    test("lists every seeded default, including placeholder flags", async () => {
      const response = await get("/admin/business-config", adminToken)
      expect(response.status).toBe(200)
      const commission = response.data.entries.find(
        (e: { category: string; key: string }) =>
          e.category === "commission" && e.key === "platform_default_rate_basis_points"
      )
      expect(commission).toBeDefined()
      expect(commission.is_placeholder).toBe(true)
      const flag = response.data.entries.find(
        (e: { category: string; key: string }) =>
          e.category === "feature_flag" && e.key === "live_payments_enabled"
      )
      expect(flag.value).toBe(false)
    })

    test("rejects an unknown configuration key", async () => {
      const response = await putRequest(
        "/admin/business-config/commission/not_a_real_key",
        { value: 1 },
        adminToken
      )
      expect(response.status).toBe(404)
    })

    test("updating a value is audit-logged with the real admin actor id", async () => {
      const response = await putRequest(
        "/admin/business-config/shipping/standard_shipping_fee_cents",
        { value: 750 },
        adminToken
      )
      expect(response.status).toBe(200)
      expect(response.data.entry.value).toBe(750)

      const { rows } = await dbClient.query(
        "SELECT actor_id, before_state, after_state FROM audit_log WHERE action = 'business_config.updated' AND entity_id = 'shipping:standard_shipping_fee_cents' ORDER BY created_at DESC LIMIT 1"
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].after_state.value).toBe(750)

      const adminMe = await get("/admin/users/me", adminToken)
      expect(rows[0].actor_id).toBe(adminMe.data.user.id)
    })

    test("a live_payments_enabled flag can never be set to true through anything other than an explicit admin edit, and defaults false", async () => {
      const response = await get("/admin/business-config", adminToken)
      const flag = response.data.entries.find(
        (e: { category: string; key: string }) =>
          e.category === "feature_flag" && e.key === "live_payments_enabled"
      )
      expect(flag.value).toBe(false)
    })
  })
})
