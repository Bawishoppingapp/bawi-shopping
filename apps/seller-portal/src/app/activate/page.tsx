import { ActivationForm } from "@/features/auth/components/activation-form"

export default async function ActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 px-4 py-16">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Invalid activation link
        </h1>
        <p className="text-sm text-neutral-500">
          This activation link is missing or malformed. Check the link from
          your approval email and try again.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Activate your seller account
        </h1>
        <p className="text-sm text-neutral-500">
          Set a password to finish setting up your Bawi Shopping seller account.
        </p>
      </div>
      <ActivationForm token={token} />
    </main>
  )
}
