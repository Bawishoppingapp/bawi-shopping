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

/**
 * Forces every INSERT/UPDATE against `table` to fail for the duration of
 * `fn`, by adding a CHECK(false) constraint that Postgres enforces
 * regardless of role privileges (unlike GRANT/REVOKE, which the app's own
 * DB role - a local-dev superuser - would simply bypass). Used to prove the
 * approve/reject workflows roll back everything already written when a
 * later step genuinely fails, without needing any test-only hook in the
 * application code itself.
 */
async function withForcedFailure(
  dbClient: Client,
  table: string,
  fn: () => Promise<void>
) {
  await dbClient.query(
    `ALTER TABLE ${table} ADD CONSTRAINT force_test_failure CHECK (false) NOT VALID`
  )
  try {
    await fn()
  } finally {
    await dbClient.query(`ALTER TABLE ${table} DROP CONSTRAINT force_test_failure`)
  }
}

function validApplicationPayload(overrides: Record<string, unknown> = {}) {
  return {
    legal_business_name: "Acme Denim LLC",
    store_name: `Acme Denim ${Date.now()}-${Math.random()}`,
    business_type: "llc",
    contact_first_name: "Jane",
    contact_last_name: "Doe",
    business_email: `jane-${Date.now()}-${Math.random()}@acmedenim.test`,
    phone_number: "555-123-4567",
    address: {
      line1: "123 Main St",
      city: "Austin",
      state: "TX",
      postal_code: "78701",
      country: "US",
    },
    product_categories: ["Denim"],
    business_description: "We make quality denim.",
    estimated_product_count: 50,
    agreed_to_terms: true,
    ...overrides,
  }
}

describe("Seller application, admin review, and approval", () => {
  let serverProcess: Awaited<ReturnType<typeof startTestServer>>
  let dbClient: Client
  let adminToken: string
  let customerToken: string
  let activatedSellerToken: string

  const suffix = Date.now()

  beforeAll(async () => {
    serverProcess = await startTestServer()

    dbClient = new Client({ connectionString: TEST_DATABASE_URL })
    await dbClient.connect()

    const adminLogin = await post("/auth/user/emailpass", {
      email: TEST_ADMIN_EMAIL,
      password: TEST_ADMIN_PASSWORD,
    })
    adminToken = adminLogin.data.token

    const customerReg = await post("/auth/customer/emailpass/register", {
      email: `customer-${suffix}@example.test`,
      password: "correct-horse-battery-c",
    })
    customerToken = customerReg.data.token

    // An already-activated seller, to prove a seller session (as opposed to
    // an admin session) can't approve applications either.
    const provision = await post("/seller-test-support/provision", {
      name: `Existing Seller ${suffix}`,
      slug: `existing-seller-${suffix}`,
      email: `existing-seller-${suffix}@example.test`,
      password: "correct-horse-battery-s",
    })
    expect(provision.status).toBe(200)
    const sellerLogin = await post("/auth/seller_user/emailpass", {
      email: `existing-seller-${suffix}@example.test`,
      password: "correct-horse-battery-s",
    })
    activatedSellerToken = sellerLogin.data.token
  })

  afterAll(async () => {
    await dbClient?.end()
    await stopTestServer(serverProcess)
  })

  test("a member of the public can submit an application", async () => {
    const response = await post("/seller-applications", validApplicationPayload())

    expect(response.status).toBe(201)
    expect(response.data.application.status).toBe("submitted")
    expect(response.data.application.id).toBeTruthy()

    const statusCheck = await get(`/seller-applications/${response.data.application.id}`)
    expect(statusCheck.status).toBe(200)
    expect(statusCheck.data.application.status).toBe("submitted")
    // Public status check must never leak private review fields.
    expect(statusCheck.data.application.rejection_reason).toBeUndefined()
    expect(statusCheck.data.application.reviewed_by).toBeUndefined()
  })

  test("submitting invalid data is rejected with field errors", async () => {
    const response = await post("/seller-applications", { legal_business_name: "" })
    expect(response.status).toBe(400)
    expect(response.data.errors).toBeTruthy()
  })

  test("duplicate submission behavior is handled safely", async () => {
    const email = `dup-${suffix}@example.test`
    const first = await post(
      "/seller-applications",
      validApplicationPayload({ business_email: email })
    )
    expect(first.status).toBe(201)

    const second = await post(
      "/seller-applications",
      validApplicationPayload({ business_email: email, store_name: "A Different Name" })
    )
    expect(second.status).toBe(409)

    // Confirm exactly one row exists for this email, not two.
    const { rows } = await dbClient.query(
      "SELECT count(*)::int AS count FROM seller_application WHERE business_email = $1",
      [email]
    )
    expect(rows[0].count).toBe(1)
  })

  test("customer cannot approve an application", async () => {
    const submitted = await post("/seller-applications", validApplicationPayload())
    const response = await post(
      `/admin/seller-applications/${submitted.data.application.id}/approve`,
      undefined,
      customerToken
    )
    expect(response.status).toBe(401)
  })

  test("seller cannot approve an application", async () => {
    const submitted = await post("/seller-applications", validApplicationPayload())
    const response = await post(
      `/admin/seller-applications/${submitted.data.application.id}/approve`,
      undefined,
      activatedSellerToken
    )
    expect(response.status).toBe(401)
  })

  test("unauthenticated caller cannot approve an application", async () => {
    const submitted = await post("/seller-applications", validApplicationPayload())
    const response = await post(
      `/admin/seller-applications/${submitted.data.application.id}/approve`
    )
    expect(response.status).toBe(401)
  })

  test("admin can approve an application, and repeated approval does not create duplicate vendors or seller users", async () => {
    const submitted = await post("/seller-applications", validApplicationPayload())
    const applicationId = submitted.data.application.id

    const firstApproval = await post(
      `/admin/seller-applications/${applicationId}/approve`,
      undefined,
      adminToken
    )
    expect(firstApproval.status).toBe(200)
    expect(firstApproval.data.seller.id).toBeTruthy()
    expect(firstApproval.data.activation_link).toContain("/activate?token=")

    const sellerId = firstApproval.data.seller.id

    const secondApproval = await post(
      `/admin/seller-applications/${applicationId}/approve`,
      undefined,
      adminToken
    )
    expect(secondApproval.status).toBe(200)
    expect(secondApproval.data.already_approved).toBe(true)
    expect(secondApproval.data.seller.id).toBe(sellerId)

    const { rows: sellerRows } = await dbClient.query(
      "SELECT count(*)::int AS count FROM seller WHERE id = $1",
      [sellerId]
    )
    expect(sellerRows[0].count).toBe(1)

    const { rows: sellerUserRows } = await dbClient.query(
      "SELECT count(*)::int AS count FROM seller_user WHERE seller_id = $1",
      [sellerId]
    )
    expect(sellerUserRows[0].count).toBe(1)
  })

  test("approving an application creates an audit-log entry attributed to the real admin, never a client-supplied identity", async () => {
    const submitted = await post("/seller-applications", validApplicationPayload())
    const applicationId = submitted.data.application.id

    // Attempt to spoof a different admin identity via the body - the route
    // doesn't even read a body for approve, but this proves it can't matter.
    const approval = await fetch(`${BASE_URL}/admin/seller-applications/${applicationId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ actor_id: "user_some_other_admin_totally_fake" }),
    })
    expect(approval.status).toBe(200)

    const { rows } = await dbClient.query(
      "SELECT actor_type, actor_id, action, entity_id FROM audit_log WHERE entity_id = $1 AND action = 'seller_application.approved'",
      [applicationId]
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].actor_type).toBe("user")
    expect(rows[0].actor_id).not.toBe("user_some_other_admin_totally_fake")
    expect(rows[0].actor_id).toMatch(/^user_/)
  })

  test("admin can reject an application with a private reason, and a rejected applicant cannot access seller features", async () => {
    const email = `rejected-${suffix}@example.test`
    const submitted = await post(
      "/seller-applications",
      validApplicationPayload({ business_email: email })
    )
    const applicationId = submitted.data.application.id

    const rejection = await post(
      `/admin/seller-applications/${applicationId}/reject`,
      { reason: "Insufficient business information provided." },
      adminToken
    )
    expect(rejection.status).toBe(200)
    expect(rejection.data.application.status).toBe("rejected")

    const statusCheck = await get(`/seller-applications/${applicationId}`)
    expect(statusCheck.data.application.status).toBe("rejected")
    expect(statusCheck.data.application.rejection_reason).toBeUndefined()

    // No seller_user was ever created for a rejected application, so there
    // is nothing for the applicant to log into.
    const loginAttempt = await post("/auth/seller_user/emailpass", {
      email,
      password: "anything",
    })
    expect(loginAttempt.status).toBe(401)

    // Approving after rejection is an invalid transition.
    const approveAfterReject = await post(
      `/admin/seller-applications/${applicationId}/approve`,
      undefined,
      adminToken
    )
    expect(approveAfterReject.status).toBe(422)
  })

  test("repeated rejection is idempotent and does not create a second audit-log entry", async () => {
    const submitted = await post("/seller-applications", validApplicationPayload())
    const applicationId = submitted.data.application.id

    const firstRejection = await post(
      `/admin/seller-applications/${applicationId}/reject`,
      { reason: "Incomplete application." },
      adminToken
    )
    expect(firstRejection.status).toBe(200)

    const secondRejection = await post(
      `/admin/seller-applications/${applicationId}/reject`,
      { reason: "Incomplete application." },
      adminToken
    )
    expect(secondRejection.status).toBe(200)
    expect(secondRejection.data.already_rejected).toBe(true)

    const { rows } = await dbClient.query(
      "SELECT count(*)::int AS count FROM audit_log WHERE entity_id = $1 AND action = 'seller_application.rejected'",
      [applicationId]
    )
    expect(rows[0].count).toBe(1)
  })

  test("rejecting without a reason is rejected", async () => {
    const submitted = await post("/seller-applications", validApplicationPayload())
    const response = await post(
      `/admin/seller-applications/${submitted.data.application.id}/reject`,
      {},
      adminToken
    )
    expect(response.status).toBe(400)
  })

  describe("approve/reject atomicity - a failure partway through rolls back everything already written", () => {
    test("a failure creating the seller leaves the application unapproved and creates no seller, seller_user, or audit-log entry", async () => {
      const email = `rollback-seller-${suffix}@example.test`
      const submitted = await post(
        "/seller-applications",
        validApplicationPayload({ business_email: email })
      )
      const applicationId = submitted.data.application.id
      const storeName = submitted.data.application.store_name ?? undefined

      let response
      await withForcedFailure(dbClient, "seller", async () => {
        response = await post(
          `/admin/seller-applications/${applicationId}/approve`,
          undefined,
          adminToken
        )
      })

      expect(response!.status).toBeGreaterThanOrEqual(500)

      const statusCheck = await get(`/seller-applications/${applicationId}`)
      expect(statusCheck.data.application.status).toBe("submitted")

      const { rows: sellerRows } = await dbClient.query(
        "SELECT count(*)::int AS count FROM seller WHERE name = $1",
        [storeName]
      )
      expect(sellerRows[0].count).toBe(0)

      const { rows: sellerUserRows } = await dbClient.query(
        "SELECT count(*)::int AS count FROM seller_user WHERE email = $1",
        [email]
      )
      expect(sellerUserRows[0].count).toBe(0)

      const { rows: auditRows } = await dbClient.query(
        "SELECT count(*)::int AS count FROM audit_log WHERE entity_id = $1 AND action = 'seller_application.approved'",
        [applicationId]
      )
      expect(auditRows[0].count).toBe(0)
    })

    test("a failure creating the seller_user rolls back the already-created seller and leaves the application unapproved", async () => {
      const email = `rollback-seller-user-${suffix}@example.test`
      const submitted = await post(
        "/seller-applications",
        validApplicationPayload({ business_email: email })
      )
      const applicationId = submitted.data.application.id
      const storeName = submitted.data.application.store_name

      let response
      await withForcedFailure(dbClient, "seller_user", async () => {
        response = await post(
          `/admin/seller-applications/${applicationId}/approve`,
          undefined,
          adminToken
        )
      })

      expect(response!.status).toBeGreaterThanOrEqual(500)

      const statusCheck = await get(`/seller-applications/${applicationId}`)
      expect(statusCheck.data.application.status).toBe("submitted")

      // The seller created in the earlier step must not survive - otherwise
      // this would leave an "approved"-looking seller with no owner and no
      // application pointing at it.
      const { rows: sellerRows } = await dbClient.query(
        "SELECT count(*)::int AS count FROM seller WHERE name = $1",
        [storeName]
      )
      expect(sellerRows[0].count).toBe(0)

      const { rows: auditRows } = await dbClient.query(
        "SELECT count(*)::int AS count FROM audit_log WHERE entity_id = $1 AND action = 'seller_application.approved'",
        [applicationId]
      )
      expect(auditRows[0].count).toBe(0)
    })

    test("a failure recording the approval audit log rolls back the seller, the seller_user, and the application status change", async () => {
      const email = `rollback-audit-log-${suffix}@example.test`
      const submitted = await post(
        "/seller-applications",
        validApplicationPayload({ business_email: email })
      )
      const applicationId = submitted.data.application.id
      const storeName = submitted.data.application.store_name

      let response
      await withForcedFailure(dbClient, "audit_log", async () => {
        response = await post(
          `/admin/seller-applications/${applicationId}/approve`,
          undefined,
          adminToken
        )
      })

      expect(response!.status).toBeGreaterThanOrEqual(500)

      const statusCheck = await get(`/seller-applications/${applicationId}`)
      expect(statusCheck.data.application.status).toBe("submitted")

      const { rows: sellerRows } = await dbClient.query(
        "SELECT count(*)::int AS count FROM seller WHERE name = $1",
        [storeName]
      )
      expect(sellerRows[0].count).toBe(0)

      const { rows: sellerUserRows } = await dbClient.query(
        "SELECT count(*)::int AS count FROM seller_user WHERE email = $1",
        [email]
      )
      expect(sellerUserRows[0].count).toBe(0)
    })

    test("a failure recording the rejection audit log rolls back the application status change", async () => {
      const email = `rollback-reject-audit-log-${suffix}@example.test`
      const submitted = await post(
        "/seller-applications",
        validApplicationPayload({ business_email: email })
      )
      const applicationId = submitted.data.application.id

      let response
      await withForcedFailure(dbClient, "audit_log", async () => {
        response = await post(
          `/admin/seller-applications/${applicationId}/reject`,
          { reason: "Insufficient business information provided." },
          adminToken
        )
      })

      expect(response!.status).toBeGreaterThanOrEqual(500)

      const statusCheck = await get(`/seller-applications/${applicationId}`)
      expect(statusCheck.data.application.status).toBe("submitted")

      // A seller who was never actually rejected must still be able to log
      // in once activated later - i.e. this application must not be stuck
      // in a half-rejected state with no audit trail explaining why.
      const secondAttempt = await post(
        `/admin/seller-applications/${applicationId}/reject`,
        { reason: "Insufficient business information provided." },
        adminToken
      )
      expect(secondAttempt.status).toBe(200)
      expect(secondAttempt.data.already_rejected).toBeUndefined()

      const { rows: auditRows } = await dbClient.query(
        "SELECT count(*)::int AS count FROM audit_log WHERE entity_id = $1 AND action = 'seller_application.rejected'",
        [applicationId]
      )
      expect(auditRows[0].count).toBe(1)
    })
  })
})
