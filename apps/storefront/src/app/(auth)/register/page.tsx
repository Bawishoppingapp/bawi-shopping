import { RegisterForm } from "@/features/auth/components/register-form"

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">
          Create your account
        </h1>
        <p className="text-sm text-neutral-500">
          Shop independent fashion brands and boutiques on Bawi Shopping.
        </p>
      </div>
      <RegisterForm />
    </main>
  )
}
