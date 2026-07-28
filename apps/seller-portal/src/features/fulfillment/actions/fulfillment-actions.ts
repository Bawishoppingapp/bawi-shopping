"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { markPreparing, markReadyForPickup } from "../services/fulfillment-client"

export async function markPreparingAction(fulfillmentOrderId: string): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }
  await markPreparing(sessionToken, fulfillmentOrderId)
  revalidatePath(`/fulfillment/${fulfillmentOrderId}`)
  revalidatePath("/fulfillment")
}

export async function markReadyForPickupAction(fulfillmentOrderId: string): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }
  await markReadyForPickup(sessionToken, fulfillmentOrderId)
  revalidatePath(`/fulfillment/${fulfillmentOrderId}`)
  revalidatePath("/fulfillment")
}
