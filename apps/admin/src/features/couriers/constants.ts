export interface CreateCourierFormState {
  status: "idle" | "error" | "success"
  fieldErrors: Partial<Record<"name" | "email", string>>
  formError?: string
  activationUrl?: string
}

export const initialCreateCourierFormState: CreateCourierFormState = {
  status: "idle",
  fieldErrors: {},
}
