describe("createStripeConnectClient (test-support fake)", () => {
  const originalSecretKey = process.env.STRIPE_SECRET_KEY
  const originalTestSupport = process.env.ENABLE_TEST_SUPPORT_ROUTES

  beforeEach(() => {
    delete process.env.STRIPE_SECRET_KEY
    process.env.ENABLE_TEST_SUPPORT_ROUTES = "true"
    jest.resetModules()
  })

  afterAll(() => {
    process.env.STRIPE_SECRET_KEY = originalSecretKey
    process.env.ENABLE_TEST_SUPPORT_ROUTES = originalTestSupport
  })

  test("throws when neither a real key nor test-support is configured", () => {
    delete process.env.ENABLE_TEST_SUPPORT_ROUTES
    const { createStripeConnectClient } = require("../stripe-client")
    expect(() => createStripeConnectClient()).toThrow(/not configured/i)
  })

  test("creates an account with a unique test-shaped id", async () => {
    const { createStripeConnectClient } = require("../stripe-client")
    const client = createStripeConnectClient()
    const a = await client.createExpressAccount()
    const b = await client.createExpressAccount()
    expect(a.id).toMatch(/^acct_test_[0-9a-f]+$/)
    expect(a.id).not.toBe(b.id)
  })

  test("createAccountLink rejects an account id it never created", async () => {
    const { createStripeConnectClient } = require("../stripe-client")
    const client = createStripeConnectClient()
    await expect(
      client.createAccountLink({
        accountId: "acct_test_never_created",
        returnUrl: "https://seller.example/return",
        refreshUrl: "https://seller.example/refresh",
      })
    ).rejects.toThrow(/unknown test stripe account/i)
  })

  test("createAccountLink succeeds for a known account and returns a stripe.com-shaped URL", async () => {
    const { createStripeConnectClient } = require("../stripe-client")
    const client = createStripeConnectClient()
    const account = await client.createExpressAccount()
    const link = await client.createAccountLink({
      accountId: account.id,
      returnUrl: "https://seller.example/return",
      refreshUrl: "https://seller.example/refresh",
    })
    expect(link.url).toContain("connect.stripe.com")
    expect(link.url).toContain(account.id)
  })

  test("constructWebhookEvent rejects a missing/invalid test signature", () => {
    const { createStripeConnectClient } = require("../stripe-client")
    const client = createStripeConnectClient()
    const payload = JSON.stringify({ id: "evt_1", type: "account.updated", data: { object: {} } })
    expect(() => client.constructWebhookEvent(payload, undefined, "")).toThrow(/signature/i)
    expect(() => client.constructWebhookEvent(payload, "wrong-signature", "")).toThrow(/signature/i)
  })

  test("constructWebhookEvent parses a validly-tagged test payload", () => {
    const { createStripeConnectClient } = require("../stripe-client")
    const client = createStripeConnectClient()
    const payload = JSON.stringify({
      id: "evt_123",
      type: "account.updated",
      data: { object: { id: "acct_test_abc", charges_enabled: true } },
    })
    const event = client.constructWebhookEvent(payload, "test-signature", "")
    expect(event.id).toBe("evt_123")
    expect(event.type).toBe("account.updated")
    expect(event.data.object).toEqual({ id: "acct_test_abc", charges_enabled: true })
  })

  test("deleteAccount removes it from the known-account set", async () => {
    const { createStripeConnectClient } = require("../stripe-client")
    const client = createStripeConnectClient()
    const account = await client.createExpressAccount()
    await client.deleteAccount(account.id)
    await expect(
      client.createAccountLink({
        accountId: account.id,
        returnUrl: "https://seller.example/return",
        refreshUrl: "https://seller.example/refresh",
      })
    ).rejects.toThrow(/unknown test stripe account/i)
  })
})
