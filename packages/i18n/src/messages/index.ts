import enUS from "./en-US.json"
import am from "./am.json"
import ti from "./ti.json"
import om from "./om.json"
import zhCN from "./zh-CN.json"
import es from "./es.json"
import type { Locale } from "../locales"

export type MessageKey = keyof typeof enUS
export type Messages = Record<MessageKey, string>

// en-US is the required source of truth: every key that exists in any
// other locale file must exist here too (enforced by a unit test), and
// every lookup falls back to this dictionary when a key is missing
// elsewhere - see docs/ARCHITECTURE.md §12.
export const MESSAGES_BY_LOCALE: Record<Locale, Partial<Messages>> = {
  "en-US": enUS,
  am,
  ti,
  om,
  "zh-CN": zhCN,
  es,
}
