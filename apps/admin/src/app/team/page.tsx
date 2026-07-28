import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listAdminUsers, listAdminInvites } from "@/features/team/services/team-client"
import { CreateInviteForm } from "@/features/team/components/create-invite-form"
import { DeleteInviteButton } from "@/features/team/components/delete-invite-button"
import { DeleteUserButton } from "@/features/team/components/delete-user-button"

export const dynamic = "force-dynamic"

export default async function TeamPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const [users, invites] = await Promise.all([
    listAdminUsers(sessionToken),
    listAdminInvites(sessionToken),
  ])
  const pendingInvites = invites.filter((invite) => !invite.accepted)

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-12">
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
        <span className="font-medium text-neutral-900">Team</span>
        <Link href="/config" className="text-neutral-500 hover:underline">
          Configuration
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold text-neutral-900">Team</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-900">Admins</h2>
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {users.map((user) => (
            <li key={user.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-neutral-900">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-neutral-500">{user.email}</p>
              </div>
              {user.id !== admin.id && <DeleteUserButton userId={user.id} />}
            </li>
          ))}
        </ul>
      </section>

      {pendingInvites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-neutral-900">Pending invites</h2>
          <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-900">{invite.email}</p>
                  <p className="text-xs text-neutral-500">
                    Activation link (share until email delivery ships):{" "}
                    <span className="break-all font-mono">
                      /team/activate?token={invite.token}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status="Pending" />
                  <DeleteInviteButton inviteId={invite.id} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CreateInviteForm />
    </main>
  )
}
