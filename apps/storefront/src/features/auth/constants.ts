export const CUSTOMER_SESSION_COOKIE = "bawi_customer_session"

export interface RegisterFormState {
  status: "idle" | "error"
  fieldErrors: Partial<Record<"firstName" | "lastName" | "email" | "password", string>>
  formError?: string
}

export const initialRegisterState: RegisterFormState = {
  status: "idle",
  fieldErrors: {},
}

export interface LoginFormState {
  status: "idle" | "error"
  fieldErrors: Partial<Record<"email" | "password", string>>
  formError?: string
}

export const initialLoginState: LoginFormState = {
  status: "idle",
  fieldErrors: {},
}
