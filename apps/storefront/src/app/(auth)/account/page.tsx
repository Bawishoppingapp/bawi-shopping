import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Button } from "@bawi/ui"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentCustomer } from "@/features/auth/services/medusa-auth-client"
import { listAddresses } from "@/features/addresses/services/addresses-client"
import { AddressForm } from "@/features/addresses/components/address-form"
import { DeleteAddressButton } from "@/features/addresses/components/delete-address-button"
import { listNotifications } from "@/features/notifications/services/notifications-client"
import { NotificationList } from "@/features/notifications/components/notification-list"

export const dynamic = "force-dynamic"

export default async function AccountPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value

  const customer = sessionToken ? await getCurrentCustomer(sessionToken) : null

  if (!customer) {
    redirect("/login")
  }

  const [addresses, notifications] = await Promise.all([listAddresses(), listNotifications()])

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">
            Welcome, {customer.first_name}
          </h1>
          <p className="text-sm text-neutral-500">{customer.email}</p>
        </div>
        <Link href="/orders">
          <Button variant="secondary">View your orders</Button>
        </Link>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-neutral-900">Saved addresses</h2>
        {addresses.length > 0 && (
          <ul className="flex flex-col gap-3">
            {addresses.map((address) => (
              <li
                key={address.id}
                className="flex items-start justify-between gap-4 rounded-md border border-neutral-200 p-4 text-sm"
              >
                <div>
                  <p className="font-medium text-neutral-900">
                    {address.first_name} {address.last_name}
                    {address.is_default_shipping && (
                      <span className="ml-2 text-xs font-normal text-neutral-500">Default</span>
                    )}
                  </p>
                  <p className="text-neutral-600">
                    {address.address_1}
                    {address.address_2 ? `, ${address.address_2}` : ""}
                  </p>
                  <p className="text-neutral-600">
                    {address.city}, {address.province} {address.postal_code}
                  </p>
                </div>
                <DeleteAddressButton addressId={address.id} />
              </li>
            ))}
          </ul>
        )}
        <AddressForm />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-neutral-900">Notifications</h2>
        <NotificationList notifications={notifications} />
      </section>
    </main>
  )
}
