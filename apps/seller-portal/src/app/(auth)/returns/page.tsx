import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { StatusBadge } from "@bawi/ui"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { listReturnRequests } from "@/features/finance/services/finance-client"

export const dynamic = "force-dynamic"

export default async function ReturnsPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const returnRequests = await listReturnRequests(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Return requests</h1>

      {returnRequests.length === 0 ? (
        <p className="text-sm text-neutral-500">No return requests yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {returnRequests.map((returnRequest) => (
            <li key={returnRequest.id}>
              <Link
                href={`/returns/${returnRequest.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium capitalize text-neutral-900">
                    {returnRequest.reason.replace("_", " ")}
                  </span>
                  <span className="text-xs text-neutral-500">
                    Requested {new Date(returnRequest.created_at).toLocaleDateString()}
                  </span>
                </div>
                <StatusBadge status={returnRequest.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
