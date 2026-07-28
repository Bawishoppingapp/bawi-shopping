// Deliberately a distinct cookie name from ADMIN_SESSION_COOKIE - a
// courier and an admin `user` are different actor types with completely
// separate sessions, even though both portals happen to live in this one
// Next.js app (see docs/DECISIONS.md, docs/ARCHITECTURE.md §2 on why a
// dedicated 6th app wasn't built for a role this narrow).
export const COURIER_SESSION_COOKIE = "bawi_courier_session"

export interface LoginFormState {
  status: "idle" | "error"
  fieldErrors: Partial<Record<"email" | "password", string>>
  formError?: string
}

export const initialLoginState: LoginFormState = { status: "idle", fieldErrors: {} }

export interface ActivationFormState {
  status: "idle" | "error" | "success"
  formError?: string
}

export const initialActivationState: ActivationFormState = { status: "idle" }

export interface CodeFormState {
  status: "idle" | "error"
  formError?: string
}

export const initialCodeFormState: CodeFormState = { status: "idle" }
