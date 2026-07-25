import { translate } from "@bawi/i18n"
import { getLocale } from "@bawi/i18n/server"
import { LoginForm } from "@/features/auth/components/login-form"

export default async function LoginPage() {
  const locale = await getLocale()

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4 py-16">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {translate(locale, "login.title")}
        </h1>
        <p className="text-sm text-neutral-500">
          {translate(locale, "login.subtitle")}
        </p>
      </div>
      <LoginForm />
    </main>
  )
}
