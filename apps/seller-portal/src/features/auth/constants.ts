export const SELLER_SESSION_COOKIE = "bawi_seller_session"

export interface LoginFormState {
  status: "idle" | "error"
  fieldErrors: Partial<Record<"email" | "password", string>>
  formError?: string
}

export const initialLoginState: LoginFormState = {
  status: "idle",
  fieldErrors: {},
}

export interface ActivationFormState {
  status: "idle" | "error" | "success"
  fieldErrors: Partial<Record<"password" | "confirmPassword", string>>
  formError?: string
}

export const initialActivationState: ActivationFormState = {
  status: "idle",
  fieldErrors: {},
}
