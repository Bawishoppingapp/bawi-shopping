import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ConfigEntryRow } from "../components/config-entry-row"
import type { ConfigEntry } from "../services/business-config-client"

vi.mock("../actions/update-entry", () => ({
  updateConfigEntryAction: vi.fn(),
}))

function entry(overrides: Partial<ConfigEntry> = {}): ConfigEntry {
  return {
    category: "shipping",
    key: "standard_shipping_fee_cents",
    value: 699,
    value_type: "integer",
    label: "Standard shipping fee (cents)",
    description: null,
    is_placeholder: true,
    is_sensitive: false,
    updated_by: null,
    updated_at: null,
    ...overrides,
  }
}

describe("ConfigEntryRow", () => {
  test("renders a number input for an integer entry, pre-filled with its value", () => {
    render(<ConfigEntryRow entry={entry()} />)
    expect(screen.getByRole("spinbutton")).toHaveValue(699)
  })

  test("renders a checkbox for a boolean entry", () => {
    render(
      <ConfigEntryRow
        entry={entry({
          category: "feature_flag",
          key: "live_payments_enabled",
          value: false,
          value_type: "boolean",
          label: "live_payments_enabled",
          is_placeholder: false,
          is_sensitive: true,
        })}
      />
    )
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  test("renders a text input for a string entry", () => {
    render(
      <ConfigEntryRow
        entry={entry({
          category: "support",
          key: "support_email",
          value: "support@example.bawishopping.com",
          value_type: "string",
          label: "Customer support email",
        })}
      />
    )
    expect(screen.getByRole("textbox")).toHaveValue("support@example.bawishopping.com")
  })

  test("shows a Placeholder badge for a placeholder entry", () => {
    render(<ConfigEntryRow entry={entry({ is_placeholder: true })} />)
    expect(screen.getByText("Placeholder")).toBeInTheDocument()
  })

  test("shows a High-risk badge for a sensitive entry (feature flags)", () => {
    render(
      <ConfigEntryRow
        entry={entry({
          category: "feature_flag",
          key: "live_payments_enabled",
          value_type: "boolean",
          is_placeholder: false,
          is_sensitive: true,
        })}
      />
    )
    expect(screen.getByText("High-risk")).toBeInTheDocument()
  })

  test("does not show either badge for a normal, non-placeholder, non-sensitive entry", () => {
    render(
      <ConfigEntryRow
        entry={entry({
          category: "payment_methods",
          key: "currency",
          value: "USD",
          value_type: "string",
          is_placeholder: false,
          is_sensitive: false,
        })}
      />
    )
    expect(screen.queryByText("Placeholder")).not.toBeInTheDocument()
    expect(screen.queryByText("High-risk")).not.toBeInTheDocument()
  })
})
