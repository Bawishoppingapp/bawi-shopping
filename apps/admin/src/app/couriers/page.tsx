import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listCouriers } from "@/features/couriers/services/couriers-client"
import { CreateCourierForm } from "@/features/couriers/components/create-courier-form"

export const dynamic = "force-dynamic"

export default async function CouriersPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const couriers = await listCouriers(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-12">
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
        <span className="font-medium text-neutral-900">Couriers</span>
        <Link href="/config" className="text-neutral-500 hover:underline">
          Configuration
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold text-neutral-900">Couriers</h1>

      <CreateCourierForm />

      {couriers.length === 0 ? (
        <p className="text-sm text-neutral-500">No couriers yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {couriers.map((courier) => (
            <li key={courier.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-neutral-900">{courier.name}</span>
                <span className="text-xs text-neutral-500">{courier.email}</span>
              </div>
              <StatusBadge status={courier.activated ? "Live" : "Pending"} />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
