"use client"

import { useCallback, useEffect, useState } from "react"

export interface ImageWorkflowData {
  audit?: { id: string; action: string; actor: string | null; at: string }[]
  configured: boolean
  workflow: null | {
    id: string; status: string; imageUrl?: string; sellerApproved?: boolean; error?: string
    regenerationCount: number; validation: null | { status: string; reasons: string[] }
    sources: { front: string; back: string; detail?: string; attributes: Record<string, string> }
  }
}
export type ImageCommand = { action: string; sources?: unknown; reason?: string }
const fields = ["category", "color", "material", "pattern", "sleeves", "neckline", "length", "fit", "sizes"]

/** Authenticated server actions are injected by each app; no tokens reach this component. */
export function ImageWorkflow({ originals, admin = false, read, send }: {
  originals: string[]; admin?: boolean
  read: () => Promise<ImageWorkflowData>; send: (command: ImageCommand) => Promise<ImageWorkflowData>
}) {
  const [data, setData] = useState<ImageWorkflowData | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [reason, setReason] = useState("")
  const refresh = useCallback(async () => { try { setData(await read()) } catch { setError("Could not load image workflow. Try again.") } }, [read])
  useEffect(() => { void refresh() }, [refresh])
  const state = data?.workflow
  const pending = state && ["validating", "queued", "generating"].includes(state.status)
  useEffect(() => {
    if (!pending) return
    const timer = setInterval(() => { void refresh() }, 5000)
    return () => clearInterval(timer)
  }, [pending, refresh])
  async function act(command: ImageCommand) {
    setBusy(true); setError("")
    try { setData(await send(command)) } catch { setError("Could not complete this action. Check your photos and attributes, then refresh and try again.") }
    finally { setBusy(false) }
  }
  return <section className="flex flex-col gap-4 rounded-lg border p-4">
    <h2 className="text-lg font-semibold">Bawi image studio</h2>
    <p className="text-sm">Use separate front and back photos, with a detail/fabric photo recommended. Show one complete garment, centered and straight-on, against a simple background in even lighting. Use true colors, at least 1024 pixels per side, no filters, screenshots, watermarks, text or borders. Avoid obstructions and extreme folds.</p>
    <p className="text-sm">Original photos stay in the customer gallery. Compare color, cut, pattern, neckline, sleeves, fastenings, length and fabric before approving. Bawi reviews the hero before publication.</p>
    {error && <p role="alert">{error}</p>}
    {!data ? <p>Loading image workflow…</p> : !data.configured ? <p>AI generation is unavailable until Bawi configures a provider and a licensed model profile. You can still upload originals and submit your product.</p> : null}
    <p aria-live="polite">{state ? `Status: ${state.status.replaceAll("_", " ")} · Regenerations: ${state.regenerationCount}` : "No AI image requested"}</p>
    {state?.error && <p>Generation could not finish. You can retry the same job without creating another request.</p>}
    {state?.validation?.reasons.map((r) => <p key={r}>{r}</p>)}
    {state?.sellerApproved && <p>Seller checked the garment. Awaiting Bawi approval.</p>}
    {state?.imageUrl && <div className="flex flex-wrap gap-3">
      {[state.sources.front, state.sources.back, state.imageUrl].map((url, i) => <figure key={`${i}:${url}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={i === 2 ? "Generated preview for review" : "Original garment reference"} className="h-48 w-36 rounded object-contain" />
        <figcaption>{i === 2 ? "Generated preview" : i === 0 ? "Original front" : "Original back"}</figcaption>
      </figure>)}
    </div>}
    {data?.configured && !pending && (!state || ["needs_correction", "rejected", "failed"].includes(state.status)) && <form className="flex flex-col gap-3" onSubmit={(event) => {
      event.preventDefault()
      const form = new FormData(event.currentTarget)
      void act({ action: "request", sources: { front: form.get("front"), back: form.get("back"), ...(form.get("detail") ? { detail: form.get("detail") } : {}), attributes: Object.fromEntries(fields.map((f) => [f, form.get(f)])) } })
    }}>
      {["front", "back", "detail"].map((view) => <label key={view}>{view === "detail" ? "Detail (recommended)" : `${view} (required)`}<select required={view !== "detail"} name={view} className="block w-full rounded border p-2"><option value="">Choose original photo</option>{originals.map((url, i) => <option key={url} value={url}>Photo {i + 1}</option>)}</select></label>)}
      {fields.map((field) => <label key={field}>{field}<input required maxLength={100} name={field} defaultValue={state?.sources.attributes[field] ?? ""} className="block w-full rounded border p-2" /></label>)}
      <button disabled={busy || originals.length < 2} className="rounded border p-2">Check photos and generate one hero</button>
    </form>}
    <div className="flex flex-wrap gap-2">
      <button disabled={busy} onClick={() => void refresh()} className="rounded border p-2">Refresh status</button>
      {state?.status === "failed" && data?.configured && <button disabled={busy} onClick={() => void act({ action: "retry" })}>Retry same job</button>}
      {state?.status === "review" && <button disabled={busy} onClick={() => void act({ action: "approve" })}>{admin ? "Approve hero for customers" : "Garment matches — approve"}</button>}
      {admin && state?.status === "admin_review" && <button disabled={busy} onClick={() => void act({ action: "approve_source" })}>Approve sources for generation</button>}
      {state && ["review", "rejected"].includes(state.status) && data?.configured && <button disabled={busy} onClick={() => void act({ action: "regenerate" })}>Regenerate one hero</button>}
    </div>
    {state && ["review", "approved", "admin_review"].includes(state.status) && <div className="flex flex-col gap-2">
      <label>Mismatch or review reason<textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="block w-full rounded border p-2" /></label>
      <button disabled={busy || reason.trim().length < 3} onClick={() => void act({ action: admin ? "reject" : "mismatch", reason })}>{admin ? "Reject image" : "Report mismatch to Bawi"}</button>
    </div>}
    {admin && data?.audit && <details><summary>Recent review audit</summary><ul>{data.audit.map((entry) => <li key={entry.id}>{entry.at} · {entry.action} · {entry.actor ?? "system"}</li>)}</ul></details>}
  </section>
}
