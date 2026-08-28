import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { AuthWorkflowEvents, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { recordNotification } from "../notifications/record-notification"

interface PasswordResetEventData {
  entity_id: string
  actor_type: string
  token: string
}

/**
 * Medusa's native emailpass reset-password flow (generateResetPasswordTokenWorkflow)
 * emits auth.password_reset but ships no subscriber of its own - without
 * one, the generated token never reaches anyone at all, regardless of
 * real_email_enabled. Not indexed into notification_inbox_entry - the
 * customer isn't authenticated yet at this point, so they couldn't read
 * it there anyway; the notification module's local provider logging the
 * token is the dev-mode delivery channel here, same as every other
 * "log-only" flow in this project (e.g. seller activation). Only
 * customer resets are handled - admin/seller_user password resets aren't
 * part of this app's scope yet.
 *
 * The notification-local provider's own send() only logs
 * `to`/`channel`/`template`/`data` (see its source) - it never logs
 * `content.subject`/`content.text`, so the reset code itself would never
 * actually appear anywhere without this explicit log line, regardless of
 * real_email_enabled.
 */
export default async function customerPasswordResetHandler({
  event: { data },
  container,
}: SubscriberArgs<PasswordResetEventData>) {
  if (data.actor_type !== "customer") {
    return
  }

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info(`Password reset code for ${data.entity_id}: ${data.token}`)

  await recordNotification(container, {
    idempotencyKey: `password_reset:${data.token}`,
    eventType: "password_reset",
    to: data.entity_id,
    subject: "Reset your Bawi Shopping password",
    body: `Your password reset code is: ${data.token}\n\nThis code expires in 15 minutes. If you didn't request this, you can ignore it.`,
  })
}

export const config: SubscriberConfig = {
  event: AuthWorkflowEvents.PASSWORD_RESET,
}
