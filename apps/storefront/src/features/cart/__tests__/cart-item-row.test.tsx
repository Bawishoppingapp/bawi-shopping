import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { LocaleProvider } from "@bawi/i18n"
import { CartItemRow } from "../components/cart-item-row"
import type { CartItem, CartWarning } from "../constants"

vi.mock("../actions/update-quantity", () => ({
  updateQuantity: vi.fn(),
}))
vi.mock("../actions/remove-item", () => ({
  removeItem: vi.fn(),
}))

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "cali_1",
    variant_id: "variant_1",
    product_code: "BW-ABC123",
    title: "Denim Jacket",
    thumbnail: null,
    brand: "Bawi Shopping Seller",
    color: "Blue",
    size: "M",
    quantity: 2,
    unit_price: 5000,
    line_total: 10000,
    available_quantity: 10,
    is_available: true,
    max_quantity: 10,
    ...overrides,
  }
}

function renderRow(overrides: Partial<CartItem> = {}, warnings: CartWarning[] = [], currencyCode = "usd") {
  return render(
    <LocaleProvider locale="en-US">
      <ul>
        <CartItemRow item={item(overrides)} warnings={warnings} currencyCode={currencyCode} />
      </ul>
    </LocaleProvider>
  )
}

describe("CartItemRow", () => {
  test("renders title, brand, color/size, product code, and line total", () => {
    renderRow()
    expect(screen.getByText("Denim Jacket")).toBeInTheDocument()
    expect(screen.getByText("Bawi Shopping Seller")).toBeInTheDocument()
    expect(screen.getByText("Blue / M")).toBeInTheDocument()
    expect(screen.getByText("BW-ABC123")).toBeInTheDocument()
    expect(screen.getByText("$100.00")).toBeInTheDocument()
  })

  test("renders an ETB line total in Birr, not dollars", () => {
    renderRow({ line_total: 500000 }, [], "etb")
    expect(screen.getByText("Br 5,000")).toBeInTheDocument()
  })

  test("never renders a vendor_id or seller field, even implicitly", () => {
    const { container } = renderRow()
    expect(container.innerHTML).not.toMatch(/vendor_id/i)
    expect(container.innerHTML).not.toMatch(/seller_id/i)
  })

  test("shows a quantity input and update control for an available item", () => {
    renderRow()
    expect(screen.getByLabelText("Quantity")).toHaveValue(2)
    // The accessible name includes the item title (not just "Update") so
    // a screen reader user tabbing through several rows can tell them
    // apart - see cart-item-row.tsx.
    expect(screen.getByRole("button", { name: /^Update - Denim Jacket$/ })).toBeInTheDocument()
  })

  test("shows a remove control with an item-specific accessible name", () => {
    renderRow()
    expect(screen.getByRole("button", { name: /^Remove - Denim Jacket$/ })).toBeInTheDocument()
  })

  test("hides the quantity control for an unavailable item and shows the warning", () => {
    renderRow(
      { is_available: false, available_quantity: 0 },
      [{ line_item_id: "cali_1", code: "unavailable", message: "gone" }]
    )
    expect(screen.queryByLabelText("Quantity")).not.toBeInTheDocument()
    expect(screen.getByText("This item is no longer available")).toBeInTheDocument()
  })

  test("shows a quantity-exceeds-inventory warning", () => {
    renderRow({}, [
      { line_item_id: "cali_1", code: "quantity_exceeds_inventory", message: "limited" },
    ])
    expect(screen.getByText("Only a limited quantity is available")).toBeInTheDocument()
  })

  test("shows a price-changed warning", () => {
    renderRow({}, [{ line_item_id: "cali_1", code: "price_changed", message: "changed" }])
    expect(screen.getByText("The price of this item has changed")).toBeInTheDocument()
  })

  test("does not show a warning belonging to a different line item", () => {
    renderRow({}, [{ line_item_id: "cali_other", code: "unavailable", message: "gone" }])
    expect(screen.queryByText("This item is no longer available")).not.toBeInTheDocument()
  })
})
