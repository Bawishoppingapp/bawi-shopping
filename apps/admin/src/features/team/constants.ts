import type { CreateInviteState } from "./actions/team-actions"

export const initialCreateInviteState: CreateInviteState = { status: "idle" }

export interface AcceptInviteFormState {
  status: "idle" | "error" | "success"
  formError?: string
}

export const initialAcceptInviteState: AcceptInviteFormState = { status: "idle" }
