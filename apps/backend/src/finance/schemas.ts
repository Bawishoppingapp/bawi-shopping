import { z } from "@medusajs/framework/zod"

export const createReturnRequestSchema = z.object({
  vendor_order_item_id: z.string().min(1),
  reason: z.enum(["damaged", "defective", "incorrect", "customer_remorse"]),
  customer_comment: z.string().max(1000).optional().nullable(),
})

export const denyReturnRequestSchema = z.object({
  seller_response: z.string().min(1).max(1000),
})

export const approveReturnRequestSchema = z.object({
  requested_amount: z.number().int().positive().optional(),
})

export const createPayoutBatchSchema = z.object({
  vendor_id: z.string().min(1),
})

export type CreateReturnRequestInput = z.infer<typeof createReturnRequestSchema>
export type DenyReturnRequestInput = z.infer<typeof denyReturnRequestSchema>
export type ApproveReturnRequestInput = z.infer<typeof approveReturnRequestSchema>
export type CreatePayoutBatchInput = z.infer<typeof createPayoutBatchSchema>
