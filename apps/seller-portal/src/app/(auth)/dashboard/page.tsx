import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentSeller } from "@/features/auth/services/medusa-auth-client"

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value

  const me = sessionToken ? await getCurrentSeller(sessionToken) : null

  if (!me) {
    redirect("/login")
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-2 px-4 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">
        {me.seller.name}
      </h1>
      <p className="text-sm text-neutral-500">
        Signed in as {me.seller_user.role} · {me.seller.slug}
      </p>
    </main>
  )
}
