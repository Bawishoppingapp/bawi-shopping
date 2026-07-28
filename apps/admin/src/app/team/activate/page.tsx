import { AcceptInviteForm } from "@/features/team/components/accept-invite-form"

export default async function TeamActivatePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-16">
        <p className="text-sm text-red-600">Missing invite token.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Activate your account</h1>
        <p className="text-sm text-neutral-500">Finish setting up your admin account.</p>
      </div>
      <AcceptInviteForm token={token} />
    </main>
  )
}
