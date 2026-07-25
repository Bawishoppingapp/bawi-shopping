import Link from "next/link"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { getSellerApplication } from "@/features/seller-applications/services/seller-applications-client"
import { ReviewActions } from "@/features/seller-applications/components/review-actions"

// This page shows a private rejection_reason field - must never be cached
// by the browser keyed only on the URL (found while investigating the same
// class of issue on the product-listing pages - see docs/DECISIONS.md).
export const dynamic = "force-dynamic"

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const application = await getSellerApplication(sessionToken, id)
  if (!application) {
    notFound()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <Link href="/applications" className="text-sm text-neutral-500 hover:underline">
        &larr; All applications
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            {application.store_name}
          </h1>
          <p className="text-sm text-neutral-500">{application.legal_business_name}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-neutral-200 p-4 text-sm">
        <dt className="text-neutral-500">Contact</dt>
        <dd className="text-neutral-900">
          {application.contact_first_name} {application.contact_last_name}
        </dd>
        <dt className="text-neutral-500">Business email</dt>
        <dd className="text-neutral-900">{application.business_email}</dd>
        <dt className="text-neutral-500">Phone</dt>
        <dd className="text-neutral-900">{application.phone_number}</dd>
        <dt className="text-neutral-500">Website</dt>
        <dd className="text-neutral-900">{application.website_url || "-"}</dd>
        <dt className="text-neutral-500">Business type</dt>
        <dd className="text-neutral-900">{application.business_type}</dd>
        <dt className="text-neutral-500">Est. products</dt>
        <dd className="text-neutral-900">{application.estimated_product_count}</dd>
        <dt className="text-neutral-500">Categories</dt>
        <dd className="text-neutral-900">{application.product_categories.join(", ")}</dd>
        <dt className="text-neutral-500">Address</dt>
        <dd className="text-neutral-900">
          {application.address.line1}
          {application.address.line2 ? `, ${application.address.line2}` : ""},{" "}
          {application.address.city}, {application.address.state}{" "}
          {application.address.postal_code}
        </dd>
        <dt className="text-neutral-500">Submitted</dt>
        <dd className="text-neutral-900">
          {new Date(application.submitted_at).toLocaleString()}
        </dd>
      </dl>

      <div className="rounded-md border border-neutral-200 p-4 text-sm">
        <p className="mb-1 font-medium text-neutral-900">Business description</p>
        <p className="text-neutral-600">{application.business_description}</p>
      </div>

      {application.status === "rejected" && application.rejection_reason && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm">
          <p className="mb-1 font-medium text-red-800">
            Rejection reason (private - never shown to the applicant)
          </p>
          <p className="text-red-700">{application.rejection_reason}</p>
        </div>
      )}

      <ReviewActions applicationId={application.id} initialStatus={application.status} />
    </main>
  )
}
