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

  it("uses email-only text for delivery without putting a one-time link in the inbox", async () => {
    process.env.EMAIL_PROVIDER = "resend"
    const createNotifications = jest.fn().mockResolvedValue({ id: "notification_test" })
    const createNotificationInboxEntries = jest.fn().mockResolvedValue({})
    const container = {
      resolve: (key: string) => key === "business_config"
        ? { getFeatureFlag: jest.fn().mockResolvedValue(true) }
        : key === "notification_inbox"
          ? { createNotificationInboxEntries }
          : { createNotifications },
    }
    await recordNotification(container as never, {
      idempotencyKey: "approval:test",
      eventType: "seller_application_approved",
      to: "seller@example.com",
      subject: "Approved",
      body: "Your application was approved.",
      emailBody: "Activate: https://sell.example.com/activate?token=secret123",
      recipientType: "user",
      recipientId: "user_test",
    })
    expect(createNotifications).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.objectContaining({ text: expect.stringContaining("secret123") }),
    }))
    expect(createNotificationInboxEntries).toHaveBeenCalledWith(expect.objectContaining({
      body: "Your application was approved.",
    }))
  })
})
