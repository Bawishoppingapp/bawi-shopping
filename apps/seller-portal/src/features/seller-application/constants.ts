export interface ApplicationFormState {
  status: "idle" | "error"
  fieldErrors: Record<string, string>
  formError?: string
}

export const initialApplicationState: ApplicationFormState = {
  status: "idle",
  fieldErrors: {},
}
