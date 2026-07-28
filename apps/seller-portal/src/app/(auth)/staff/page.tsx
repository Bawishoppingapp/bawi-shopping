import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { listStaff } from "@/features/staff/services/staff-client"
import { InviteStaffForm } from "@/features/staff/components/invite-staff-form"
import { RemoveStaffButton } from "@/features/staff/components/remove-staff-button"

export const dynamic = "force-dynamic"

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  catalog_manager: "Catalog manager",
  order_fulfiller: "Order fulfiller",
  analyst: "Analyst",
}

export default async function StaffPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const staff = await listStaff(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Team</h1>

      <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
        {staff.map((member) => (
          <li key={member.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-neutral-900">{member.email}</span>
              <span className="text-xs text-neutral-500">
                {ROLE_LABELS[member.role] ?? member.role}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={member.activated ? "Live" : "Pending"} />
              {member.role !== "owner" && <RemoveStaffButton staffId={member.id} />}
            </div>
          </li>
        ))}
      </ul>

      <InviteStaffForm />
    </main>
  )
}
