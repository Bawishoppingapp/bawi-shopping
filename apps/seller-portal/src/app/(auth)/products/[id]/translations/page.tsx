import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { listTranslations } from "@/features/translations/services/translations-client"
import { TranslationForm } from "@/features/translations/components/translation-form"
import { TRANSLATABLE_LOCALES } from "@/features/translations/constants"

export const dynamic = "force-dynamic"

export default async function ProductTranslationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const translations = await listTranslations(sessionToken, id)
  const translationByLocale = new Map(translations.map((t) => [t.locale, t]))

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Translations</h1>
        <p className="text-sm text-neutral-500">
          Submitted translations go live only after Bawi review approves them.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {TRANSLATABLE_LOCALES.map((locale) => (
          <TranslationForm
            key={locale}
            productListingId={id}
            locale={locale}
            translation={translationByLocale.get(locale)}
          />
        ))}
      </div>
    </main>
  )
}
