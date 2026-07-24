import { notFound } from "next/navigation"
import { getSellerApplicationStatus } from "@/features/seller-application/services/seller-application-client"

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  draft: {
    title: "Application not yet submitted",
    body: "This application hasn't been submitted for review yet.",
  },
  submitted: {
    title: "Application received",
    body: "Thanks for applying! Our team will review your application and follow up by email - typically within a few business days.",
  },
  under_review: {
    title: "Application under review",
    body: "Your application is currently being reviewed. We'll follow up by email once a decision has been made.",
  },
  approved: {
    title: "Application approved",
    body: "Congratulations - your seller account has been approved! Check your email for a link to activate your account and log in.",
  },
  rejected: {
    title: "Application not approved",
    body: "We're not able to approve this application at this time. If you have questions, please contact our support team.",
  },
  withdrawn: {
    title: "Application withdrawn",
    body: "This application has been withdrawn.",
  },
}

export default async function ApplicationStatusPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const application = await getSellerApplicationStatus(id)

  if (!application) {
    notFound()
  }

  const message = STATUS_MESSAGES[application.status] ?? {
    title: "Application status",
    body: "",
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 px-4 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">
        {application.store_name}
      </p>
      <h1 className="text-2xl font-semibold text-neutral-900">{message.title}</h1>
      <p className="text-sm text-neutral-600">{message.body}</p>
      <p className="mt-4 text-xs text-neutral-400">
        Application reference: {application.id}
      </p>
    </main>
  )
}
