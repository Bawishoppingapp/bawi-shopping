import { describe, expect, test, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { LocaleProvider } from "../locale-context"

const setLocaleMock = vi.fn()
vi.mock("../set-locale-action", () => ({
  setLocale: (...args: unknown[]) => setLocaleMock(...args),
}))

const { LanguageSelector } = await import("../language-selector")

describe("LanguageSelector", () => {
  test("shows every supported locale as an option, with the active one selected", () => {
    render(
      <LocaleProvider locale="es">
        <LanguageSelector />
      </LocaleProvider>
    )
    const select = screen.getByLabelText("Idioma") as HTMLSelectElement
    expect(select.value).toBe("es")
    expect(screen.getByRole("option", { name: "English" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "አማርኛ" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "ትግርኛ" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Afaan Oromoo" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "简体中文" })).toBeInTheDocument()
  })

  test("switching the selection submits the new locale to the persistence action", () => {
    render(
      <LocaleProvider locale="en-US">
        <LanguageSelector />
      </LocaleProvider>
    )
    const select = screen.getByLabelText("Language") as HTMLSelectElement

    fireEvent.change(select, { target: { value: "am" } })

    expect(setLocaleMock).toHaveBeenCalledTimes(1)
    const submittedFormData = setLocaleMock.mock.calls[0]?.[0] as FormData
    expect(submittedFormData.get("locale")).toBe("am")
  })
})
