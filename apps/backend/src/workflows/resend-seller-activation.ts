import { randomUUID } from "node:crypto"
import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import {
  ACTIVATION_TOKEN_TTL_MS,
  buildSellerActivationLink,
  generateActivationToken,
} from "../modules/seller-application/utils"
import { recordNotification } from "../notifications/record-notification"
import { sellerApplicationApprovedTemplate } from "../notifications/templates"

type ResendInput = {
  applicationId: string
  sellerId: string
  sellerUserId: string
  email: string
  storeName: string
}

const rotateTokenStep = createStep(
  "rotate-token",
  async (input: { sellerUserId: string }, { container }) => {
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    const user = await sellers.retrieveSellerUser(input.sellerUserId)
    const token = generateActivationToken()
    await sellers.updateSellerUsers({
      id: user.id,
      activation_token: token,
      activation_token_expires_at: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
    })
    return new StepResponse({ token }, {
      sellerUserId: user.id,
      previousToken: user.activation_token,
      previousExpiresAt: user.activation_token_expires_at,
    })
  },
  async (previous, { container }) => {
    if (!previous) return
    const sellers: SellerModuleService = container.resolve(SELLER_MODULE)
    await sellers.updateSellerUsers({
      id: previous.sellerUserId,
      activation_token: previous.previousToken,
      activation_token_expires_at: previous.previousExpiresAt,
    })
  }
)

const sendActivationEmailStep = createStep(
  "send-activation-email",
  async (input: ResendInput & { token: string }, { container }) => {
    const { subject, body, emailBody, html } = sellerApplicationApprovedTemplate({
      storeName: input.storeName,
      activationLink: buildSellerActivationLink(input.token),
    })
    await recordNotification(container, {
      idempotencyKey: `seller_activation_resend:${input.applicationId}:${randomUUID()}`,
      eventType: "seller_application_approved",
      to: input.email,
      subject,
      body,
      emailBody,
      html,
      recipientType: "seller_user",
      recipientId: input.sellerUserId,
      vendorId: input.sellerId,
      resourceId: input.applicationId,
      resourceType: "seller_application",
    })
    return new StepResponse(null)
  }
)

export const resendSellerActivationWorkflow = createWorkflow(
  "resend-seller-activation",
  (input: ResendInput) => {
    const { token } = rotateTokenStep({ sellerUserId: input.sellerUserId })
    sendActivationEmailStep({
      applicationId: input.applicationId,
      sellerId: input.sellerId,
      sellerUserId: input.sellerUserId,
      email: input.email,
      storeName: input.storeName,
      token,
    })
    return new WorkflowResponse({ email: input.email })
  }
)
