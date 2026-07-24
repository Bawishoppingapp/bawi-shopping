import { describe, expect, test, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LoginForm } from "../components/login-form"
import * as loginAction from "../actions/login"

// Not importing the real module: it transitively pulls in
// medusa-auth-client.ts, guarded by "server-only", which throws in jsdom
// (jsdom defines `window`, same check server-only uses to detect a browser).
vi.mock("../actions/login", () => ({
  loginSeller: vi.fn(),
}))

describe("LoginForm", () => {
  test("renders email, password, and submit", () => {
    render(<LoginForm />)

    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument()
  })

  test("shows a field error returned by the action", async () => {
    vi.mocked(loginAction.loginSeller).mockResolvedValue({
      status: "error",
      fieldErrors: { email: "Enter a valid email address" },
    })

    render(<LoginForm />)
    await userEvent.click(screen.getByRole("button", { name: "Log in" }))

    await waitFor(() => {
      expect(screen.getByText("Enter a valid email address")).toBeInTheDocument()
    })
  })

  test("shows a generic error on invalid credentials, never confirming which field was wrong", async () => {
    vi.mocked(loginAction.loginSeller).mockResolvedValue({
      status: "error",
      fieldErrors: {},
      formError: "Invalid email or password",
    })

    render(<LoginForm />)
    await userEvent.click(screen.getByRole("button", { name: "Log in" }))

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument()
    })
  })
})
