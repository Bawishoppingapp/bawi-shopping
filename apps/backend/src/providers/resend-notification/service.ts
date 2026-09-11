import type { Logger, NotificationTypes } from "@medusajs/framework/types"
import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"

type Dependencies = { logger: Logger }
type Options = { api_key?: string; from?: string; from_name?: string }

/** Transactional email through Resend's HTTPS API. Keeping this provider
 * behind EMAIL_PROVIDER=resend means local development remains log-only and
 * the production API key never enters the mobile bundle or source control. */
export class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = "notification-resend"
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
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "RESEND_API_KEY and RESEND_FROM_EMAIL are required when EMAIL_PROVIDER=resend"
      )
    }
  }

  async send(
    notification: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    if (!notification?.to) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "No email recipient provided")
    }
    if (!("content" in notification) || !notification.content) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Resend email content is required")
    }

    const senderAddress = notification.from?.trim() || this.from_
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey_}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${this.fromName_} <${senderAddress}>`,
        to: [notification.to],
        subject: notification.content.subject,
        html: notification.content.html,
        text: notification.content.text,
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      this.logger_.error(`Resend email failed (${response.status}): ${detail.slice(0, 500)}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Resend could not send email (${response.status})`
      )
    }

    const result = (await response.json().catch(() => ({}))) as { id?: string }
    return { id: result.id }
  }
}
