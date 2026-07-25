import { describe, expect, test, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LocaleProvider } from "@bawi/i18n"
import { RegisterForm } from "../components/register-form"
import * as registerAction from "../actions/register"

function renderForm() {
  return render(
    <LocaleProvider locale="en-US">
      <RegisterForm />
    </LocaleProvider>
  )
}

// Does not import the actual module: it transitively pulls in
// medusa-auth-client.ts, which is guarded by "server-only" and throws in
// jsdom (which defines `window`, same as a browser). The component test
// only needs the action to be a callable stub, not the real server logic.
vi.mock("../actions/register", () => ({
  registerCustomer: vi.fn(),
}))

describe("RegisterForm", () => {
  test("renders all fields and the submit button", () => {
    renderForm()

    expect(screen.getByLabelText("First name")).toBeInTheDocument()
    expect(screen.getByLabelText("Last name")).toBeInTheDocument()
    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument()
  })

  test("shows field errors returned by the action", async () => {
    vi.mocked(registerAction.registerCustomer).mockResolvedValue({
      status: "error",
      fieldErrors: { email: "Enter a valid email address" },
    })

    renderForm()
    await userEvent.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(screen.getByText("Enter a valid email address")).toBeInTheDocument()
    })
  })

  test("shows a form-level error for a duplicate account", async () => {
    vi.mocked(registerAction.registerCustomer).mockResolvedValue({
      status: "error",
      fieldErrors: {},
      formError: "An account with this email already exists.",
    })

    renderForm()
    await userEvent.click(screen.getByRole("button", { name: "Create account" }))

    await waitFor(() => {
      expect(
        screen.getByText("An account with this email already exists.")
      ).toBeInTheDocument()
    })
  })
})
