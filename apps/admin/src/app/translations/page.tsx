import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listPendingTranslations } from "@/features/translations/services/translations-client"
import { TranslationReviewItem } from "@/features/translations/components/translation-review-item"

export const dynamic = "force-dynamic"

export default async function TranslationsPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const translations = await listPendingTranslations(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/applications" className="text-neutral-500 hover:underline">
          Applications
        </Link>
        <Link href="/products" className="text-neutral-500 hover:underline">
          Products
        </Link>
        <Link href="/categories" className="text-neutral-500 hover:underline">
          Categories
        </Link>
        <Link href="/sellers" className="text-neutral-500 hover:underline">
          Sellers
        </Link>
        <Link href="/fulfillment" className="text-neutral-500 hover:underline">
          Fulfillment
        </Link>
        <Link href="/couriers" className="text-neutral-500 hover:underline">
          Couriers
        </Link>
        <Link href="/finance" className="text-neutral-500 hover:underline">
          Finance
        </Link>
        <Link href="/team" className="text-neutral-500 hover:underline">
          Team
        </Link>
        <span className="font-medium text-neutral-900">Translations</span>
        <Link href="/config" className="text-neutral-500 hover:underline">
          Configuration
        </Link>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Translation review</h1>
        <p className="text-sm text-neutral-500">
          {translations.length} submission{translations.length === 1 ? "" : "s"} awaiting review.
        </p>
      </div>

      {translations.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          Nothing pending review.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {translations.map((translation) => (
            <TranslationReviewItem key={translation.id} translation={translation} />
          ))}
        </ul>
      )}
    </main>
  )
}
