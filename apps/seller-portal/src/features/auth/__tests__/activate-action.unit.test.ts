import { describe, expect, test, vi } from "vitest"
import { activateSellerAccount } from "../actions/activate"
import { completeSellerActivation } from "../services/medusa-auth-client"

vi.mock("../services/medusa-auth-client", () => ({
  completeSellerActivation: vi.fn().mockResolvedValue(undefined),
  MedusaAuthError: class MedusaAuthError extends Error {},
}))

describe("activateSellerAccount", () => {
  test("submits an existing password without a hidden confirmation field", async () => {
    const form = new FormData()
    form.set("token", "valid-token")
    form.set("existingAccount", "true")
    form.set("password", "ExistingPassword1")

    const result = await activateSellerAccount({ status: "idle", fieldErrors: {} }, form)

    expect(completeSellerActivation).toHaveBeenCalledWith("valid-token", "ExistingPassword1")
    expect(result).toEqual({ status: "success", fieldErrors: {} })
  })
})
