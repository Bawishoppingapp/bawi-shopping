import { CourierLoginForm } from "@/features/courier-portal/components/login-form"

export default function CourierLoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Bawi courier</h1>
        <p className="text-sm text-neutral-500">Log in to see your assigned deliveries.</p>
      </div>
      <CourierLoginForm />
    </main>
  )
}
