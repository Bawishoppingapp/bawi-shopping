import { describe, expect, test, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LocaleProvider } from "@bawi/i18n"
import { LoginForm } from "../components/login-form"
import * as loginAction from "../actions/login"

function renderForm() {
  return render(
    <LocaleProvider locale="en-US">
      <LoginForm />
    </LocaleProvider>
  )
}

// Same reasoning as register-form.test.tsx: avoid transitively importing
// medusa-auth-client.ts (guarded by "server-only").
vi.mock("../actions/login", () => ({
  loginCustomerAction: vi.fn(),
}))

describe("LoginForm", () => {
  test("renders email/password fields and the submit button", () => {
    renderForm()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument()
  })

  test("links to the register page", () => {
    renderForm()
    expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute("href", "/register")
  })

  test("shows a generic error for invalid credentials, never confirming/denying the email", async () => {
    vi.mocked(loginAction.loginCustomerAction).mockResolvedValue({
      status: "error",
      fieldErrors: {},
      formError: "Invalid email or password.",
    })

    renderForm()
    await userEvent.click(screen.getByRole("button", { name: "Log in" }))

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password.")).toBeInTheDocument()
    })
  })
})
