import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listSellerApplications } from "@/features/seller-applications/services/seller-applications-client"
import { StatusFilter } from "@/features/seller-applications/components/status-filter"

// Session-scoped (admin-authenticated) content must never be cached by the
// browser keyed only on the URL.
export const dynamic = "force-dynamic"

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status = "" } = await searchParams
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const { applications, count } = await listSellerApplications(
    sessionToken,
    status || undefined
  )

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#B8863B]">Seller onboarding</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Seller applications</h1>
          <p className="mt-2 text-sm text-neutral-500">Review each business before giving it access to the seller portal.</p>
        </div>
        <div className="rounded-xl border border-[#E3DCD1] bg-white px-5 py-3 text-right">
          <span className="block text-2xl font-semibold text-[#312B26]">{count}</span>
          <span className="text-xs text-neutral-500">applications in view</span>
        </div>
      </header>

      <StatusFilter activeStatus={status} />

      {applications.length === 0 ? (
        <div className="rounded-xl border border-[#E3DCD1] bg-white px-6 py-16 text-center">
          <p className="font-medium text-[#312B26]">No applications here yet</p>
          <p className="mt-1 text-sm text-neutral-500">Try another status to see more applications.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Store / business</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Submitted</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/applications/${application.id}`}
                      className="font-semibold text-[#312B26] underline-offset-2 hover:underline"
                    >
                      {application.store_name}
                    </Link>
                    <p className="mt-1 text-xs text-neutral-500">{application.legal_business_name}</p>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {application.contact_first_name} {application.contact_last_name}
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {new Date(application.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={application.status} />
                  </td>
                  <td className="px-4 py-3 text-right"><Link href={`/applications/${application.id}`} aria-label={`Review ${application.store_name}`} className="text-sm font-semibold text-[#B8863B] hover:underline">Review →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
