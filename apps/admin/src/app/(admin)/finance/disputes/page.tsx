import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listDisputes } from "@/features/finance/services/finance-client"

export const dynamic = "force-dynamic"

function formatEtb(cents: number): string {
  return `${(cents / 100).toFixed(2)} ETB`
}

export default async function DisputesPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const disputes = await listDisputes(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12">
      <Link href="/finance" className="text-sm text-neutral-500 hover:underline">
        ← Finance
      </Link>
      <h1 className="text-2xl font-semibold text-neutral-900">Disputes</h1>

      {disputes.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          No disputes recorded.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {disputes.map((dispute) => (
            <li key={dispute.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-neutral-900">
                  {formatEtb(dispute.amount)} · Payment issue
                </span>
                <span className="text-xs text-neutral-500">
                  {dispute.reason ?? "No reason given"} · opened{" "}
                  {new Date(dispute.created_at).toLocaleDateString()}
                </span>
              </div>
              <StatusBadge status={dispute.status} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
