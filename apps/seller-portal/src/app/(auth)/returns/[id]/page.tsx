import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import {
  getReturnRequest,
  FinanceClientError,
} from "@/features/finance/services/finance-client"
import { ApproveReturnForm } from "@/features/finance/components/approve-return-form"
import { DenyReturnForm } from "@/features/finance/components/deny-return-form"

export const dynamic = "force-dynamic"

export default async function ReturnRequestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  let returnRequest
  try {
    returnRequest = await getReturnRequest(sessionToken, id)
  } catch (error) {
    if (error instanceof FinanceClientError) {
      notFound()
    }
    throw error
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold capitalize text-neutral-900">
          {returnRequest.reason.replace("_", " ")} return
        </h1>
        <StatusBadge status={returnRequest.status} />
      </div>

      <section className="rounded-md border border-neutral-200 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-900">Customer&apos;s note</h2>
        <p className="text-sm text-neutral-700">
          {returnRequest.customer_comment ?? "No additional comment provided."}
        </p>
      </section>

      {returnRequest.status === "requested" && (
        <div className="flex flex-col gap-4">
          <ApproveReturnForm returnRequestId={returnRequest.id} />
          <DenyReturnForm returnRequestId={returnRequest.id} />
        </div>
      )}

      {returnRequest.seller_response && (
        <section className="rounded-md border border-neutral-200 p-4">
          <h2 className="mb-2 text-sm font-medium text-neutral-900">Your response</h2>
          <p className="text-sm text-neutral-700">{returnRequest.seller_response}</p>
        </section>
      )}
    </main>
  )
}
