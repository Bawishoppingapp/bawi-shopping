import { recordNotification } from "../record-notification"

describe("email provider routing", () => {
  const originalProvider = process.env.EMAIL_PROVIDER
  afterEach(() => {
    if (originalProvider === undefined) delete process.env.EMAIL_PROVIDER
    else process.env.EMAIL_PROVIDER = originalProvider
  })

  it.each([
    [true, "resend", "email"],
    [true, "brevo", "email"],
    [true, "sendgrid", "email"],
    [false, "resend", "email-local"],
    [true, "local", "email-local"],
    [true, "", "email-local"],
  ])("routes enabled=%s provider=%s to %s", async (enabled, provider, channel) => {
    process.env.EMAIL_PROVIDER = provider
    const createNotifications = jest.fn().mockResolvedValue({ id: "notification_test" })
    const container = {
      resolve: (key: string) => key === "business_config"
        ? { getFeatureFlag: jest.fn().mockResolvedValue(enabled) }
        : { createNotifications },
    }
    await recordNotification(container as never, {
      idempotencyKey: "reset:test",
      eventType: "password_reset",
      to: "test@example.com",
      subject: "Reset password",
      body: "Secure reset link",
    })
    expect(createNotifications).toHaveBeenCalledWith(expect.objectContaining({ channel }))
  })
})
