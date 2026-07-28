import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listAdminReturnRequests } from "@/features/finance/services/finance-client"

export const dynamic = "force-dynamic"

/** Read-only oversight - approval/denial stays with the seller (see
 * apps/seller-portal's /returns pages); this exists for support/dispute
 * review visibility only. */
export default async function AdminReturnsPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const returnRequests = await listAdminReturnRequests(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12">
      <Link href="/finance" className="text-sm text-neutral-500 hover:underline">
        ← Finance
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900">Return requests</h1>

      {returnRequests.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          No return requests yet.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {returnRequests.map((returnRequest) => (
            <li key={returnRequest.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium capitalize text-neutral-900">
                  {returnRequest.reason.replace("_", " ")}
                </span>
                <span className="text-xs text-neutral-500">
                  Seller {returnRequest.vendor_id} · requested{" "}
                  {new Date(returnRequest.created_at).toLocaleDateString()}
                </span>
              </div>
              <StatusBadge status={returnRequest.status} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
