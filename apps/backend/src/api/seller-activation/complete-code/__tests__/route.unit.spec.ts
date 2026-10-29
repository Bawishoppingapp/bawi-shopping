import { POST } from "../route"
import { SELLER_MODULE } from "../../../../modules/seller"

jest.mock("../../../seller-session/token", () => ({
  issueSellerSessionToken: jest.fn().mockReturnValue("signed-seller-session"),
}))

describe("code-only seller activation", () => {
  const setup = (hasIdentity = true) => {
    const sellers = {
      listSellerUsers: jest.fn().mockResolvedValue([{
        id: "seller_user_1",
        email: "owner@example.com",
        auth_identity_id: null,
        activation_token_expires_at: new Date(Date.now() + 60_000),
      }]),
      updateSellerUsers: jest.fn().mockResolvedValue({}),
    }
    const auth = {
      listProviderIdentities: jest.fn().mockResolvedValue(hasIdentity ? [{ auth_identity_id: "auth_1" }] : []),
      retrieveAuthIdentity: jest.fn().mockResolvedValue({ id: "auth_1", app_metadata: { customer_id: "customer_1" } }),
      updateAuthIdentities: jest.fn().mockResolvedValue({ id: "auth_1", app_metadata: { customer_id: "customer_1", seller_user_id: "seller_user_1" } }),
      register: jest.fn().mockResolvedValue({ success: true, authIdentity: { id: "auth_1" } }),
    }
    const req = {
      body: { code: "abcd-efgh-jklm" },
      scope: { resolve: (name: string) => name === SELLER_MODULE ? sellers : auth },
    }
    const res = { status: jest.fn(), json: jest.fn() }
    res.status.mockReturnValue(res)
    return { sellers, auth, req, res }
  }

  it("accepts a grouped code, links the existing identity, and returns a session without a password", async () => {
    const { sellers, auth, req, res } = setup()
    await POST(req as never, res as never)
    expect(sellers.listSellerUsers).toHaveBeenCalledWith({ activation_token: "ABCDEFGHJKLM" })
    expect(sellers.updateSellerUsers).toHaveBeenCalledWith(expect.objectContaining({
      id: "seller_user_1", auth_identity_id: "auth_1", activation_token: null,
    }))
    expect(auth.updateAuthIdentities).toHaveBeenCalledWith({
      id: "auth_1", app_metadata: { customer_id: "customer_1", seller_user_id: "seller_user_1" },
    })
    expect(res.json).toHaveBeenCalledWith({ token: "signed-seller-session" })
  })

  it("uses the signed-in customer identity when the business email has no separate login", async () => {
    const { auth, req, res } = setup(false)
    Object.assign(req, { auth_context: { actor_type: "customer", auth_identity_id: "auth_1" } })
    await POST(req as never, res as never)
    expect(auth.retrieveAuthIdentity).toHaveBeenCalledWith("auth_1")
    expect(res.json).toHaveBeenCalledWith({ token: "signed-seller-session" })
  })

  it("creates a login automatically when no Bawi identity exists", async () => {
    const { auth, req, res } = setup(false)
    await POST(req as never, res as never)
    expect(auth.register).toHaveBeenCalledWith("emailpass", {
      body: { email: "owner@example.com", password: expect.any(String) },
    })
    expect(res.json).toHaveBeenCalledWith({ token: "signed-seller-session" })
  })

  it("keeps the code unused when identity registration fails", async () => {
    const { sellers, auth, req, res } = setup(false)
    auth.register.mockResolvedValue({ success: false })
    await POST(req as never, res as never)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(sellers.updateSellerUsers).not.toHaveBeenCalled()
  })
})
