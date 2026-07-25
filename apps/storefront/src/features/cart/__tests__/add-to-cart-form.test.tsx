import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LocaleProvider } from "@bawi/i18n"
import { AddToCartForm } from "../components/add-to-cart-form"
import * as addToCartAction from "../actions/add-to-cart"
import type { PublicProductVariant } from "@/features/products/services/products-client"

vi.mock("../actions/add-to-cart", () => ({
  addToCart: vi.fn(),
}))

const variants: PublicProductVariant[] = [
  { id: "variant_blue_m", color: "Blue", size: "M", price: 5000, available_quantity: 5 },
  { id: "variant_blue_l", color: "Blue", size: "L", price: 5000, available_quantity: 0 },
  { id: "variant_red_m", color: "Red", size: "M", price: 5000, available_quantity: 3 },
]

function renderForm(variantList = variants) {
  return render(
    <LocaleProvider locale="en-US">
      <AddToCartForm variants={variantList} />
    </LocaleProvider>
  )
}

describe("AddToCartForm", () => {
  test("renders color and size selectors defaulting to the first variant", () => {
    renderForm()
    expect(screen.getByLabelText("Color")).toHaveValue("Blue")
    expect(screen.getByLabelText("Size")).toHaveValue("M")
  })

  test("narrows size options to the selected color", async () => {
    renderForm()
    await userEvent.selectOptions(screen.getByLabelText("Color"), "Red")
    const sizeSelect = screen.getByLabelText("Size") as HTMLSelectElement
    const options = Array.from(sizeSelect.options).map((o) => o.value)
    expect(options).toEqual(["M"])
  })

  test("disables the submit button when the selected variant is out of stock", async () => {
    renderForm()
    await userEvent.selectOptions(screen.getByLabelText("Size"), "L")
    expect(screen.getByRole("button", { name: "Out of stock" })).toBeDisabled()
  })

  test("submits the resolved variant id and shows a success message", async () => {
    vi.mocked(addToCartAction.addToCart).mockResolvedValue({ status: "idle" })
    renderForm()

    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }))

    expect(screen.getByText("Added to cart")).toBeInTheDocument()
  })

  test("shows a form-level error returned by the action", async () => {
    vi.mocked(addToCartAction.addToCart).mockResolvedValue({
      status: "error",
      formError: "Only a limited quantity is available.",
    })
    renderForm()

    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }))

    expect(screen.getByText("Only a limited quantity is available.")).toBeInTheDocument()
  })
})
