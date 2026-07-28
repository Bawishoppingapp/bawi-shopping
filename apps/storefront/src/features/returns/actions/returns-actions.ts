"use server"

import { revalidatePath } from "next/cache"
import { cancelVendorOrder, createReturnRequest, ReturnsClientError } from "../services/returns-client"

export interface CancelOrderState {
  status: "idle" | "error"
  message?: string
}

export async function cancelOrderAction(
  orderId: string,
  vendorOrderId: string,
  _prevState: CancelOrderState,
  _formData: FormData
): Promise<CancelOrderState> {
  try {
    await cancelVendorOrder(vendorOrderId)
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ReturnsClientError ? error.message : "Could not cancel this order",
    }
  }
  revalidatePath(`/orders/${orderId}`)
  return { status: "idle" }
}

export interface ReturnRequestState {
  status: "idle" | "success" | "error"
  message?: string
}

export async function createReturnRequestAction(
  orderId: string,
  vendorOrderItemId: string,
  _prevState: ReturnRequestState,
  formData: FormData
): Promise<ReturnRequestState> {
  const reason = String(formData.get("reason") ?? "")
  if (!["damaged", "defective", "incorrect", "customer_remorse"].includes(reason)) {
    return { status: "error", message: "Choose a reason for the return" }
  }
  const customerCommentRaw = String(formData.get("customer_comment") ?? "").trim()

  try {
    await createReturnRequest({
      vendorOrderItemId,
      reason: reason as "damaged" | "defective" | "incorrect" | "customer_remorse",
      customerComment: customerCommentRaw || null,
    })
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof ReturnsClientError ? error.message : "Could not submit this return request",
    }
  }
  revalidatePath(`/orders/${orderId}`)
  return { status: "success" }
}
