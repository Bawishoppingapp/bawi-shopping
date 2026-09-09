import { translate } from "@bawi/i18n"
import { getLocale } from "@bawi/i18n/server"

const SUPPORT_EMAIL = "support@bawishopping.com"

export default async function SupportPage() {
  const locale = await getLocale()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
          {translate(locale, "support.title")}
        </h1>
        <p className="max-w-2xl text-neutral-600">{translate(locale, "support.intro")}</p>
      </div>

      <section className="rounded-lg border border-neutral-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900">
          {translate(locale, "support.emailTitle")}
        </h2>
        <p className="mt-2 text-sm text-neutral-600">{translate(locale, "support.emailHint")}</p>
        <a
          className="mt-4 inline-flex rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          href={`mailto:${SUPPORT_EMAIL}`}
        >
          {SUPPORT_EMAIL}
        </a>
      </section>

      <section className="rounded-lg bg-neutral-50 p-6 text-sm text-neutral-600">
        <h2 className="font-semibold text-neutral-900">{translate(locale, "support.includeTitle")}</h2>
        <p className="mt-2">{translate(locale, "support.includeHint")}</p>
      </section>
    </main>
  )
}
