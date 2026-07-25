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
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-12">
      <nav className="flex gap-4 text-sm">
        <span className="font-medium text-neutral-900">Applications</span>
        <Link href="/products" className="text-neutral-500 hover:underline">
          Products
        </Link>
        <Link href="/categories" className="text-neutral-500 hover:underline">
          Categories
        </Link>
        <Link href="/sellers" className="text-neutral-500 hover:underline">
          Sellers
        </Link>
        <Link href="/config" className="text-neutral-500 hover:underline">
          Configuration
        </Link>
      </nav>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Seller applications
        </h1>
        <p className="text-sm text-neutral-500">{count} total</p>
      </div>

      <StatusFilter activeStatus={status} />

      {applications.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          No applications match this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Store</th>
                <th className="px-4 py-2 font-medium">Contact</th>
                <th className="px-4 py-2 font-medium">Submitted</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((application) => (
                <tr key={application.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/applications/${application.id}`}
                      className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      {application.store_name}
                    </Link>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
