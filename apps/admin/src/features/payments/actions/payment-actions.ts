"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { approvePayment, rejectPayment } from "../services/payments-client"

export async function approvePaymentAction(formData: FormData) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!token) throw new Error("Unauthorized")
  await approvePayment(token, String(formData.get("id")))
  revalidatePath("/payments")
}

export async function rejectPaymentAction(formData: FormData) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!token) throw new Error("Unauthorized")
  await rejectPayment(token, String(formData.get("id")), String(formData.get("reason") ?? ""))
  revalidatePath("/payments")
}
