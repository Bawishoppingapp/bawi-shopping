import { z } from "@medusajs/framework/zod"

export const createCourierSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
})

export const assignCourierSchema = z.object({
  courier_id: z.string().min(1),
})

export const submitCodeSchema = z.object({
  code: z.string().min(1),
})

export const courierActivationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
})

export type CreateCourierInput = z.infer<typeof createCourierSchema>
export type AssignCourierInput = z.infer<typeof assignCourierSchema>
export type SubmitCodeInput = z.infer<typeof submitCodeSchema>
export type CourierActivationInput = z.infer<typeof courierActivationSchema>
