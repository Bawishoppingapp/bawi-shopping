import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentCustomer } from "@/features/auth/services/medusa-auth-client"

export default async function AccountPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value

  const customer = sessionToken ? await getCurrentCustomer(sessionToken) : null

  if (!customer) {
    redirect("/login")
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-2 px-4 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">
        Welcome, {customer.first_name}
      </h1>
      <p className="text-sm text-neutral-500">{customer.email}</p>
    </main>
  )
}
