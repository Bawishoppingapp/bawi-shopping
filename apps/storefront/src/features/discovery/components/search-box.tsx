"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@bawi/ui"

export function SearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleSubmit(formData: FormData) {
    const params = new URLSearchParams(searchParams.toString())
    const q = formData.get("q")
    if (typeof q === "string" && q.trim()) {
      params.set("q", q.trim())
    } else {
      params.delete("q")
    }
    params.delete("cursor")
    router.push(`/search?${params.toString()}`)
  }

  return (
    <form action={handleSubmit} role="search" className="w-full max-w-md">
      <Input
        type="search"
        name="q"
        placeholder={placeholder}
        aria-label={placeholder}
        defaultValue={searchParams.get("q") ?? ""}
      />
    </form>
  )
}
