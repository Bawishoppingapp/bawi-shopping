import { startTestServer, stopTestServer, PORT } from "./test-server"

jest.setTimeout(120 * 1000)

const BASE_URL = `http://localhost:${PORT}`

async function post(path: string, body: unknown, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

async function get(path: string, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return { status: response.status, data: await response.json() }
}

describe("Seller authentication and customer registration (real server, real Postgres)", () => {
  let serverProcess: Awaited<ReturnType<typeof startTestServer>>

  beforeAll(async () => {
    serverProcess = await startTestServer()
  })

  afterAll(async () => {
    await stopTestServer(serverProcess)
  })

  describe("Seller authentication and vendor association", () => {
    let sellerAToken: string
    let sellerAId: string
    let sellerBId: string

    const suffix = Date.now()

    beforeAll(async () => {
      const sellerA = await post("/seller-test-support/provision", {
        name: `Seller A ${suffix}`,
        slug: `seller-a-${suffix}`,
        email: `owner-a-${suffix}@example.test`,
        password: "correct-horse-battery-a",
      })
      sellerAId = sellerA.data.seller.id

      const sellerB = await post("/seller-test-support/provision", {
        name: `Seller B ${suffix}`,
        slug: `seller-b-${suffix}`,
        email: `owner-b-${suffix}@example.test`,
        password: "correct-horse-battery-b",
      })
      sellerBId = sellerB.data.seller.id

      const login = await post("/auth/seller_user/emailpass", {
        email: `owner-a-${suffix}@example.test`,
        password: "correct-horse-battery-a",
      })
      sellerAToken = login.data.token
    })

    test("valid login returns a token and /seller/me resolves the caller's own vendor", async () => {
      const response = await get("/seller/me", sellerAToken)

      expect(response.status).toBe(200)
      expect(response.data.seller.id).toBe(sellerAId)
      expect(response.data.seller.slug).toBe(`seller-a-${suffix}`)
    })

    test("seller A's token never resolves to seller B's vendor record", async () => {
      const response = await get("/seller/me", sellerAToken)

      expect(response.status).toBe(200)
      expect(response.data.seller.id).not.toBe(sellerBId)
    })

    test("wrong password is rejected", async () => {
      const response = await post("/auth/seller_user/emailpass", {
        email: `owner-a-${suffix}@example.test`,
        password: "wrong-password",
      })

      expect(response.status).toBe(401)
    })

    test("/seller/me without a token is rejected", async () => {
      const response = await get("/seller/me")

      expect(response.status).toBe(401)
    })
  })

  describe("Customer registration", () => {
    const suffix = Date.now() + 1
    let publishableApiKey: string

    beforeAll(async () => {
      const response = await get("/seller-test-support/publishable-key")
      publishableApiKey = response.data.token
    })

    test("registering then creating a customer succeeds", async () => {
      const email = `jane-${suffix}@example.test`
      const registerResponse = await post("/auth/customer/emailpass/register", {
        email,
        password: "correct-horse-battery-2",
      })
      expect(registerResponse.status).toBe(200)

      const customerResponse = await fetch(`${BASE_URL}/store/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${registerResponse.data.token}`,
          "x-publishable-api-key": publishableApiKey,
        },
        body: JSON.stringify({
          email,
          first_name: "Jane",
          last_name: "Doe",
        }),
      })
      const customerData = await customerResponse.json()

      expect(customerResponse.status).toBe(200)
      expect(customerData.customer.email).toBe(email)
    })

    test("registering the same email twice is rejected once the first registration completed", async () => {
      // Medusa allows re-registering an email whose auth identity was never
      // linked to an actor (e.g. an abandoned signup) - that's a resume, not
      // a duplicate. It's only a genuine duplicate once a Customer exists
      // for it, so that's the sequence this test has to exercise.
      const email = `duplicate-${suffix}@example.test`
      const firstRegister = await post("/auth/customer/emailpass/register", {
        email,
        password: "correct-horse-battery-3",
      })
      await fetch(`${BASE_URL}/store/customers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firstRegister.data.token}`,
          "x-publishable-api-key": publishableApiKey,
        },
        body: JSON.stringify({ email, first_name: "Dup", last_name: "Licate" }),
      })

      const secondAttempt = await post("/auth/customer/emailpass/register", {
        email,
        password: "a-different-password",
      })

      expect(secondAttempt.status).toBe(401)
    })

    test("missing password is rejected", async () => {
      const response = await post("/auth/customer/emailpass/register", {
        email: `weak-${suffix}@example.test`,
      })

      expect(response.status).toBe(401)
    })
  })
})
