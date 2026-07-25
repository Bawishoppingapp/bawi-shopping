import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@bawi/ui"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentSeller } from "@/features/auth/services/medusa-auth-client"

// Session-scoped content must never be cached by the browser keyed only on
// the URL - see docs/DECISIONS.md (product-listing page caching finding).
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value

  const me = sessionToken ? await getCurrentSeller(sessionToken) : null

  if (!me) {
    redirect("/login")
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-4 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {me.seller.name}
        </h1>
        <p className="text-sm text-neutral-500">
          Signed in as {me.seller_user.role} · {me.seller.slug}
        </p>
      </div>
      <Link href="/products">
        <Button>Manage products</Button>
      </Link>
    </main>
  )
}
