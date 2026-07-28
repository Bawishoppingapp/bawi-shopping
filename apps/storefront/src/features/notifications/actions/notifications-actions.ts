"use server"

import { revalidatePath } from "next/cache"
import { markNotificationRead } from "../services/notifications-client"

export async function markNotificationReadAction(notificationId: string): Promise<void> {
  await markNotificationRead(notificationId)
  revalidatePath("/account")
}
