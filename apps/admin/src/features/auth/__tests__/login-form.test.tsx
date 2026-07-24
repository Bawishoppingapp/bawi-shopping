import { describe, expect, test, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LoginForm } from "../components/login-form"
import * as loginAction from "../actions/login"

vi.mock("../actions/login", () => ({
  loginAdmin: vi.fn(),
}))

describe("LoginForm", () => {
  test("renders email, password, and submit", () => {
    render(<LoginForm />)

    expect(screen.getByLabelText("Email")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument()
  })

  test("shows a generic error on invalid credentials", async () => {
    vi.mocked(loginAction.loginAdmin).mockResolvedValue({
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
