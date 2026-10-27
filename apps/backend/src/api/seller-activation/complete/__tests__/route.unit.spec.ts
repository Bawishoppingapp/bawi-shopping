import { POST } from "../route"
import { SELLER_MODULE } from "../../../../modules/seller"

describe("seller activation", () => {
  const sellerUser = () => ({
    id: "seller_user_1",
    email: "seller@example.com",
    activation_token: "valid-token",
    activation_token_expires_at: new Date(Date.now() + 60_000),
    auth_identity_id: null,
  })

  const setup = (hasIdentity: boolean, passwordValid = true) => {
    const sellers = {
      listSellerUsers: jest.fn().mockResolvedValue([sellerUser()]),
      updateSellerUsers: jest.fn().mockResolvedValue({}),
    }
    const auth = {
      listProviderIdentities: jest.fn().mockResolvedValue(hasIdentity ? [{ id: "provider_1" }] : []),
      authenticate: jest.fn().mockResolvedValue(passwordValid
        ? { success: true, authIdentity: { id: "auth_1", app_metadata: { customer_id: "customer_1" } } }
        : { success: false, error: "Invalid email or password" }),
      register: jest.fn().mockResolvedValue({ success: true, authIdentity: { id: "auth_2", app_metadata: {} } }),
      updateAuthIdentities: jest.fn().mockResolvedValue({}),
    }
    const req = {
      body: { token: "valid-token", password: "CurrentPassword1" },
      scope: { resolve: (name: string) => name === SELLER_MODULE ? sellers : auth },
    }
    const res = { status: jest.fn(), json: jest.fn() }
    res.status.mockReturnValue(res)
    return { sellers, auth, req, res }
  }

  it("reuses an existing customer identity and preserves customer access", async () => {
    const { sellers, auth, req, res } = setup(true)
    await POST(req as never, res as never)
    expect(auth.authenticate).toHaveBeenCalledWith("emailpass", {
      body: { email: "seller@example.com", password: "CurrentPassword1" },
    })
    expect(auth.register).not.toHaveBeenCalled()
    expect(auth.updateAuthIdentities).toHaveBeenCalledWith({
      id: "auth_1",
      app_metadata: { customer_id: "customer_1", seller_user_id: "seller_user_1" },
    })
    expect(sellers.updateSellerUsers).toHaveBeenCalledWith(expect.objectContaining({ auth_identity_id: "auth_1", activation_token: null }))
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it("does not link an existing identity when the password is wrong", async () => {
    const { sellers, auth, req, res } = setup(true, false)
    await POST(req as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(auth.updateAuthIdentities).not.toHaveBeenCalled()
    expect(sellers.updateSellerUsers).not.toHaveBeenCalled()
  })

  it("creates an identity for a new seller", async () => {
    const { auth, req, res } = setup(false)
    await POST(req as never, res as never)
    expect(auth.register).toHaveBeenCalledTimes(1)
    expect(auth.authenticate).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ success: true })
  })

  it("still rejects a weak new-account password", async () => {
    const { auth, req, res } = setup(false)
    req.body.password = "weak"
    await POST(req as never, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(auth.register).not.toHaveBeenCalled()
  })
})
