export interface ConfigEntryFormState {
  status: "idle" | "error" | "success"
  formError?: string
}

export const initialConfigEntryFormState: ConfigEntryFormState = {
  status: "idle",
}
