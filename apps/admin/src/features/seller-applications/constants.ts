export interface ReviewActionState {
  status: "idle" | "error" | "success"
  formError?: string
  activationLink?: string
}

export const initialReviewActionState: ReviewActionState = {
  status: "idle",
}
