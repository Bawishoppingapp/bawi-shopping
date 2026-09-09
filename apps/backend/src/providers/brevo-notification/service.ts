import type { Logger, NotificationTypes } from "@medusajs/framework/types"
import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"

type Dependencies = { logger: Logger }
type Options = { api_key?: string; from?: string; from_name?: string }

/** Lightweight Brevo transactional-email provider. It uses Brevo's HTTPS
 * API directly so password reset delivery doesn't require another runtime
 * package. The key is read only from deployment secrets. */
export class BrevoNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-brevo"
  private readonly logger_: Logger
  private readonly apiKey_: string
  private readonly from_: string
  private readonly fromName_: string

  constructor({ logger }: Dependencies, options: Options) {
    super()
    this.logger_ = logger
    this.apiKey_ = options.api_key?.trim() ?? ""
    this.from_ = options.from?.trim() ?? ""
    this.fromName_ = options.from_name?.trim() || "Bawi Shopping"
    if (!this.apiKey_ || !this.from_) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "BREVO_API_KEY and BREVO_FROM_EMAIL are required when EMAIL_PROVIDER=brevo")
    }
  }

  async send(notification: NotificationTypes.ProviderSendNotificationDTO): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    if (!notification?.to) throw new MedusaError(MedusaError.Types.INVALID_DATA, "No email recipient provided")
    if (!("content" in notification) || !notification.content) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Brevo email content is required")

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": this.apiKey_, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: notification.from?.trim() || this.from_, name: this.fromName_ },
        to: [{ email: notification.to }],
        subject: notification.content.subject,
        htmlContent: notification.content.html,
        textContent: notification.content.text,
        ...(notification.attachments?.length ? { attachment: notification.attachments.map((item) => ({ content: item.content, name: item.filename })) } : {}),
      }),
    })
    if (!response.ok) {
      const detail = await response.text()
      this.logger_.error(`Brevo email failed (${response.status}): ${detail.slice(0, 500)}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Brevo could not send email (${response.status})`)
    }
    const result = await response.json().catch(() => ({})) as { messageId?: string }
    return { id: result.messageId }
  }
}
