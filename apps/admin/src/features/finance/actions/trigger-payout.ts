"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { triggerPayoutBatch, FinanceClientError } from "../services/finance-client"

export interface TriggerPayoutState {
  status: "idle" | "success" | "error"
  message?: string
}

export async function triggerPayoutAction(
  vendorId: string,
  _prevState: TriggerPayoutState,
  _formData: FormData
): Promise<TriggerPayoutState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  try {
    const payout = await triggerPayoutBatch(sessionToken, vendorId)
    revalidatePath("/finance")
    if (!payout) {
      return { status: "success", message: "No eligible balance to pay out right now." }
    }
    return { status: "success", message: `Payout of $${(payout.amount / 100).toFixed(2)} sent.` }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof FinanceClientError ? error.message : "Could not trigger payout",
    }
  }
}
