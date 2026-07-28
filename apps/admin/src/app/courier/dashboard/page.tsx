import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { COURIER_SESSION_COOKIE } from "@/features/courier-portal/constants"
import { getCurrentCourier } from "@/features/courier-portal/services/courier-auth-client"
import { listAssignments } from "@/features/courier-portal/services/assignments-client"

export const dynamic = "force-dynamic"

/**
 * Only this courier's own active assignments - never a customer's name,
 * phone, email, or delivery address, and never the seller's real identity
 * (see apps/backend/src/fulfillment/courier-assignment-response.ts,
 * docs/USER-ROLES.md §2.7).
 */
export default async function CourierDashboardPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(COURIER_SESSION_COOKIE)?.value

  const courier = sessionToken ? await getCurrentCourier(sessionToken) : null
  if (!courier || !sessionToken) {
    redirect("/courier/login")
  }

  const assignments = await listAssignments(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Hi, {courier.name}</h1>

      {assignments.length === 0 ? (
        <p className="text-sm text-neutral-500">No active assignments right now.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {assignments.map((assignment) => (
            <li key={assignment.id}>
              <Link
                href={`/courier/assignments/${assignment.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-900">
                    {assignment.fulfillment_code}
                  </span>
                  <span className="text-xs text-neutral-500">
                    Deadline {new Date(assignment.fulfillment_deadline_at).toLocaleString()}
                  </span>
                </div>
                <StatusBadge status={assignment.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
