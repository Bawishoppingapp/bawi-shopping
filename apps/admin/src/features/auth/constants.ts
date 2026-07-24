export const ADMIN_SESSION_COOKIE = "bawi_admin_session"

export interface LoginFormState {
  status: "idle" | "error"
  fieldErrors: Partial<Record<"email" | "password", string>>
  formError?: string
}

export const initialLoginState: LoginFormState = {
  status: "idle",
  fieldErrors: {},
}
