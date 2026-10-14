"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { approvePayment, rejectPayment, setDeliveryQuote } from "../services/payments-client"

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

export async function setDeliveryQuoteAction(formData: FormData) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!token) throw new Error("Unauthorized")
  const birr = Number(formData.get("shipping_birr"))
  if (!Number.isFinite(birr) || birr < 0 || birr > 1_000_000 || Math.round(birr * 100) !== birr * 100) {
    throw new Error("Enter a valid delivery fee in birr with at most two decimal places.")
  }
  await setDeliveryQuote(token, String(formData.get("id")), Math.round(birr * 100))
  revalidatePath("/payments")
}
