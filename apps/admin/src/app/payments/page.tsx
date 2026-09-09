import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listPayments } from "@/features/payments/services/payments-client"
import { approvePaymentAction, rejectPaymentAction } from "@/features/payments/actions/payment-actions"
import { formatMoney } from "@/features/finance/utils/format-price"

export const dynamic = "force-dynamic"

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!token || !(await getCurrentAdmin(token))) redirect("/login")
  const status = (await searchParams).status
  const payments = await listPayments(token, status)

  return <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-12">
    <nav className="flex flex-wrap gap-4 text-sm">
      <Link href="/applications" className="text-neutral-500 hover:underline">Applications</Link>
      <Link href="/products" className="text-neutral-500 hover:underline">Products</Link>
      <span className="font-medium text-neutral-900">Payments</span>
      <Link href="/finance" className="text-neutral-500 hover:underline">Finance</Link>
      <Link href="/config" className="text-neutral-500 hover:underline">Configuration</Link>
    </nav>
    <header><h1 className="text-2xl font-semibold">Manual payment verification</h1><p className="text-sm text-neutral-500">Verify the transaction inside the official Telebirr merchant account. A screenshot alone is not proof of payment.</p></header>
    <div className="flex gap-2 text-sm">
      {[['', 'All'], ['proof_submitted', 'Awaiting review'], ['succeeded', 'Approved'], ['rejected', 'Rejected']].map(([value,label]) => <Link key={label} href={value ? `/payments?status=${value}` : '/payments'} className="rounded-full border px-3 py-1 hover:bg-neutral-50">{label}</Link>)}
    </div>
    {payments.length === 0 ? <p className="rounded-md border p-8 text-center text-neutral-500">No payments found.</p> :
      <div className="grid gap-4">{payments.map((payment) => <article key={payment.id} className="rounded-lg border border-neutral-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Order {payment.display_id}</h2><p className="text-sm text-neutral-500">Transaction: {payment.transaction_reference ?? 'Not submitted'}</p></div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium">{payment.payment_status.replaceAll('_',' ')}</span></div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><div><dt className="text-neutral-500">Subtotal</dt><dd>{formatMoney(payment.subtotal, payment.currency_code)}</dd></div><div><dt className="text-neutral-500">Delivery</dt><dd>{formatMoney(payment.shipping, payment.currency_code)}</dd></div><div><dt className="text-neutral-500">Tax</dt><dd>{formatMoney(payment.tax, payment.currency_code)}</dd></div><div><dt className="text-neutral-500">Total to verify</dt><dd className="font-semibold">{formatMoney(payment.total, payment.currency_code)}</dd></div></dl>
        {payment.proof_url ? <a href={payment.proof_url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium underline">Open receipt image</a> : null}
        {payment.rejection_reason ? <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">{payment.rejection_reason}</p> : null}
        {payment.payment_status === 'proof_submitted' ? <div className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row">
          <form action={approvePaymentAction}><input type="hidden" name="id" value={payment.id}/><button className="rounded bg-neutral-950 px-4 py-2 text-sm font-medium text-white">Approve verified payment</button></form>
          <form action={rejectPaymentAction} className="flex flex-1 gap-2"><input type="hidden" name="id" value={payment.id}/><input required minLength={3} maxLength={500} name="reason" placeholder="Reason for rejection" className="min-w-0 flex-1 rounded border px-3 py-2 text-sm"/><button className="rounded border border-red-300 px-4 py-2 text-sm text-red-700">Reject</button></form>
        </div> : null}
      </article>)}</div>}
  </main>
}
