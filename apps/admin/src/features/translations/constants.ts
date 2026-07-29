import type { RejectTranslationState } from "./actions/translations-actions"

export const initialRejectTranslationState: RejectTranslationState = { status: "idle" }

export const LOCALE_LABELS: Record<string, string> = {
  am: "Amharic",
  ti: "Tigrinya",
  om: "Afaan Oromoo",
  "zh-CN": "Simplified Chinese",
  es: "Spanish",
}
