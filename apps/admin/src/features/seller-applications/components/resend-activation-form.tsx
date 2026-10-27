"use client"

import { useActionState } from "react"
import { resendActivationEmail, type ResendActivationState } from "../actions/resend-activation"

const initialState: ResendActivationState = { status: "idle" }

export function ResendActivationForm({ applicationId }: { applicationId: string }) {
  const [state, action, pending] = useActionState(
    resendActivationEmail.bind(null, applicationId), initialState
  )
  return <div className="rounded-xl border border-[#E3DCD1] bg-white p-6">
    <h2 className="text-lg font-semibold text-[#312B26]">Seller account activation</h2>
    <p className="mt-1 text-sm text-neutral-500">If the seller did not receive a usable link, send a new one. The previous link will stop working.</p>
    <form action={action} className="mt-4">
      <button type="submit" disabled={pending} className="rounded-lg bg-[#312B26] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        {pending ? "Sending…" : "Send new activation email"}
      </button>
    </form>
    {state.message && <p role="status" className={`mt-3 text-sm ${state.status === "error" ? "text-red-700" : "text-green-700"}`}>{state.message}</p>}
  </div>
}
