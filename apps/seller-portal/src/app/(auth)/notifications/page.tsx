import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { listNotifications } from "@/features/notifications/services/notifications-client"
import { NotificationList } from "@/features/notifications/components/notification-list"

export const dynamic = "force-dynamic"

export default async function NotificationsPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const notifications = await listNotifications(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Notifications</h1>
      <NotificationList notifications={notifications} />
    </main>
  )
}
