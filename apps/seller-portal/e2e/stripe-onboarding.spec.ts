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

async function provisionSeller(name: string, slug: string, email: string, password: string) {
  const response = await fetch(`${BACKEND_URL}/seller-test-support/provision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, slug, email, password }),
  })
  if (!response.ok) {
    throw new Error(`Could not provision seller: ${await response.text()}`)
  }
}

/**
 * Requires the backend to be running with ENABLE_TEST_SUPPORT_ROUTES=true
 * (same requirement as the seller-application/product-creation E2E specs) -
 * this both unlocks /seller-test-support/provision and switches
 * createStripeConnectClient() to the network-free fake client, so this
 * spec never makes a real Stripe API call. See docs/DECISIONS.md.
 */
test.describe("Seller Stripe Connect onboarding", () => {
  const suffix = Date.now()
  const sellerEmail = `e2e-stripe-seller-${suffix}@example.test`
  const sellerPassword = "correct-horse-battery-s"
  const sellerSlug = `e2e-stripe-seller-${suffix}`

  test.beforeAll(async () => {
    await provisionSeller(
      `E2E Stripe Seller ${suffix}`,
      sellerSlug,
      sellerEmail,
      sellerPassword
    )
  })

  test("dashboard shows 'not connected', clicking Connect payouts redirects to a Stripe-hosted URL", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel("Email").fill(sellerEmail)
    await page.getByLabel("Password").fill(sellerPassword)
    await page.getByRole("button", { name: "Log in" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await expect(page.getByText("Payouts not connected")).toBeVisible()

    await page.getByRole("button", { name: "Connect payouts" }).click()
    // The fake test client's link points at the real connect.stripe.com
    // domain (with a synthetic acct_test_* id, no real API call made) so
    // this proves the redirect actually leaves our app for Stripe - Stripe's
    // own server then further redirects an unrecognized test account to its
    // login page, so match stripe.com broadly rather than the exact first
    // hop, which would be flaky against Stripe's own redirect chain.
    await expect(page).toHaveURL(/stripe\.com/, { timeout: 15000 })
  })

  test("after the seller's account.updated webhook fires, the dashboard reflects live status", async ({
    page,
  }) => {
    const login = await post("/auth/seller_user/emailpass", {
      email: sellerEmail,
      password: sellerPassword,
    })

    // The seller's Stripe account id is never exposed by any API (see
    // docs/SECURITY.md §12) - the onboarding-link response reuses the
    // existing account (idempotent, see the backend integration test) and
    // the fake Stripe client's link URL always embeds the account id, so
    // that's how this test builds a realistic account.updated payload.
    const accountLink = await post(
      "/seller/stripe/onboarding-link",
      undefined,
      login.data.token
    )
    expect(accountLink.status).toBe(200)
    const accountId = new URL(accountLink.data.url).pathname.split("/").pop()

    const webhookResponse = await fetch(`${BACKEND_URL}/webhooks/stripe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": "test-signature",
      },
      body: JSON.stringify({
        id: `evt_e2e_${Date.now()}`,
        type: "account.updated",
        data: {
          object: {
            id: accountId,
            charges_enabled: true,
            payouts_enabled: true,
            details_submitted: true,
          },
        },
      }),
    })
    expect(webhookResponse.status).toBe(200)

    await page.goto("/login")
    await page.getByLabel("Email").fill(sellerEmail)
    await page.getByLabel("Password").fill(sellerPassword)
    await page.getByRole("button", { name: "Log in" }).click()
    await expect(page).toHaveURL(/\/dashboard$/)

    await expect(page.getByText("Payouts: live")).toBeVisible()
    await expect(page.getByRole("button", { name: /connect payouts/i })).not.toBeVisible()
  })
})
