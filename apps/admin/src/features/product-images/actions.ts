"use server"
import { cookies } from "next/headers"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import type { ImageWorkflowData, ImageCommand } from "@bawi/ui"

async function request(id: string, command?: ImageCommand): Promise<ImageWorkflowData> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!token) throw new Error("Unauthorized")
  const response = await fetch(`${process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"}/admin/product-listings/${encodeURIComponent(id)}/image-workflow`, {
    method: command ? "POST" : "GET", cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(command ? { body: JSON.stringify(command) } : {}),
  })
  if (!response.ok) throw new Error("Image workflow request failed")
  return response.json()
}
export async function readImageWorkflow(id: string) { return request(id) }
export async function sendImageWorkflow(id: string, command: ImageCommand) { return request(id, command) }
