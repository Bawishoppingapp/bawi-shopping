import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listConfigEntries } from "@/features/business-config/services/business-config-client"
import { ConfigEntryRow } from "@/features/business-config/components/config-entry-row"

export const dynamic = "force-dynamic"

const CATEGORY_LABELS: Record<string, string> = {
  commission: "Commission",
  transfer_timing: "Seller transfer timing",
  returns: "Returns",
  shipping: "Shipping",
  preparation: "Seller preparation",
  cancellation: "Cancellation",
  service_area: "Service area",
  brand_visibility: "Vendor brand visibility",
  payment_methods: "Payment methods",
  tax: "Tax",
  courier: "Courier",
  email: "Email",
  sms: "SMS",
  support: "Customer support",
  feature_flag: "Feature flags (real-money / real-communication gates)",
}

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS)

export default async function BusinessConfigPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const entries = await listConfigEntries(sessionToken)
  const placeholderCount = entries.filter((e) => e.is_placeholder).length

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-12">
      <nav className="flex gap-4 text-sm">
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
        <span className="font-medium text-neutral-900">Configuration</span>
      </nav>

      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Business configuration</h1>
        <p className="text-sm text-neutral-500">
          Development/staging defaults marked &ldquo;Placeholder&rdquo; must be replaced and approved before
          real production launch. Feature flags gate every code path that would move real money,
          send a real communication, or book a real courier - they are never enabled automatically.
        </p>
        {placeholderCount > 0 && (
          <p className="mt-2 text-sm font-medium text-amber-700">
            {placeholderCount} placeholder value{placeholderCount === 1 ? "" : "s"} still pending
            real approval.
          </p>
        )}
      </div>

      {CATEGORY_ORDER.map((category) => {
        const categoryEntries = entries.filter((entry) => entry.category === category)
        if (categoryEntries.length === 0) {
          return null
        }
        return (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="flex flex-col gap-3">
              {categoryEntries.map((entry) => (
                <ConfigEntryRow key={`${entry.category}:${entry.key}`} entry={entry} />
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}
