import { z } from "@medusajs/framework/zod"

export const updateConfigEntrySchema = z.object({
  value: z.union([z.number(), z.boolean(), z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]),
})

export type UpdateConfigEntryInput = z.infer<typeof updateConfigEntrySchema>
