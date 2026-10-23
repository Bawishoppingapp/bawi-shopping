import customerPasswordResetHandler from "../customer-password-reset"
import { recordNotification } from "../../notifications/record-notification"

jest.mock("../../notifications/record-notification", () => ({ recordNotification: jest.fn() }))

describe("customer password reset email", () => {
  const originalBase = process.env.PASSWORD_RESET_URL_BASE

  afterEach(() => {
    jest.clearAllMocks()
    if (originalBase === undefined) delete process.env.PASSWORD_RESET_URL_BASE
    else process.env.PASSWORD_RESET_URL_BASE = originalBase
  })

  it("sends a tappable HTTPS link with the token in the fragment", async () => {
    delete process.env.PASSWORD_RESET_URL_BASE
    await customerPasswordResetHandler({
      event: { data: { actor_type: "customer", entity_id: "shopper@example.com", token: "header.payload.signature" } },
      container: { resolve: () => ({ info: jest.fn() }) },
    } as never)

    const notification = jest.mocked(recordNotification).mock.calls[0][1]
    const link = notification.body.match(/https:\/\/\S+/)?.[0]
    expect(link).toBeDefined()
    const url = new URL(link!)
    expect(url.pathname).toBe("/reset-password")
    expect(url.search).toBe("")
    expect(new URLSearchParams(url.hash.slice(1)).get("token")).toBe("header.payload.signature")
    expect(notification.html).toContain('href="https://')
    expect(notification.html).not.toContain("mobilecustomer://")
    expect(notification.html).not.toContain("reset code")
  })
})
