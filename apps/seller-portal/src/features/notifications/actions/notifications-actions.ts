"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { markNotificationRead } from "../services/notifications-client"

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }
  await markNotificationRead(sessionToken, notificationId)
  revalidatePath("/notifications")
}
