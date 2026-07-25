export interface ReviewActionState {
  status: "idle" | "error" | "success"
  formError?: string
}

export const initialReviewActionState: ReviewActionState = {
  status: "idle",
}
