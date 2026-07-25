"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { isLocale, LOCALE_COOKIE_NAME } from "./locales"

/** Persists the chosen locale for one year, readable by client components. */
export async function setLocale(formData: FormData): Promise<void> {
  const value = formData.get("locale")
  if (typeof value !== "string" || !isLocale(value)) {
    return
  }

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE_NAME, value, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  })

  revalidatePath("/")
}
