import { ApplicationForm } from "@/features/seller-application/components/application-form"

export default function ApplyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Sell on Bawi Shopping
        </h1>
        <p className="text-sm text-neutral-500">
          Tell us about your brand. We review every application before a
          seller account is activated - approvals typically take a few
          business days.
        </p>
      </div>
      <ApplicationForm />
    </main>
  )
}
