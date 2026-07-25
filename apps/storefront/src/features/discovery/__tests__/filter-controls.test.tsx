import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { FilterControls, type FilterControlsLabels } from "../components/filter-controls"

const pushMock = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/search",
  useSearchParams: () => currentSearchParams,
}))

const labels: FilterControlsLabels = {
  title: "Filters",
  category: "Category",
  allCategories: "All categories",
  all: "All",
  brand: "Brand",
  size: "Size",
  color: "Color",
  price: "Price",
  priceMin: "Min",
  priceMax: "Max",
  availability: "Availability",
  inStockOnly: "In stock only",
  apply: "Apply filters",
  clear: "Clear all",
  close: "Close",
}

const categories = [
  {
    category: { id: "cat_shirts", name: "Shirts", handle: "shirts", parent_category_id: null, children: [] },
    depth: 0,
  },
]
const brands = [{ slug: "acme", name: "Acme Co" }]

function renderControls() {
  return render(
    <FilterControls
      categories={categories}
      brands={brands}
      sizes={["S", "M"]}
      colors={["Red", "Blue"]}
      labels={labels}
    />
  )
}

describe("FilterControls", () => {
  beforeEach(() => {
    pushMock.mockClear()
    currentSearchParams = new URLSearchParams()
  })

  test("renders category, brand, size, color, price, and availability controls", () => {
    renderControls()

    expect(screen.getByLabelText("Category")).toBeInTheDocument()
    expect(screen.getByLabelText("Brand")).toBeInTheDocument()
    expect(screen.getByLabelText("Size")).toBeInTheDocument()
    expect(screen.getByLabelText("Color")).toBeInTheDocument()
    expect(screen.getByLabelText("Min")).toBeInTheDocument()
    expect(screen.getByLabelText("Max")).toBeInTheDocument()
    expect(screen.getByText("In stock only")).toBeInTheDocument()
  })

  test("does not render size/color fields when there are no facet values", () => {
    render(
      <FilterControls categories={categories} brands={brands} sizes={[]} colors={[]} labels={labels} />
    )
    expect(screen.queryByLabelText("Size")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Color")).not.toBeInTheDocument()
  })

  test("submitting the form navigates with the selected category in the query string", async () => {
    renderControls()

    await userEvent.selectOptions(screen.getByLabelText("Category"), "cat_shirts")
    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }))

    expect(pushMock).toHaveBeenCalledTimes(1)
    const url = pushMock.mock.calls[0][0] as string
    expect(url).toContain("category=cat_shirts")
  })

  test("submitting clears the cursor param so a filter change starts back at page one", async () => {
    currentSearchParams = new URLSearchParams("cursor=abc123&sort=newest")
    renderControls()

    await userEvent.click(screen.getByRole("button", { name: "Apply filters" }))

    const url = pushMock.mock.calls[0][0] as string
    expect(url).not.toContain("cursor=")
    expect(url).toContain("sort=newest")
  })

  test("Clear all removes every filter param but keeps the pathname", async () => {
    currentSearchParams = new URLSearchParams("category=cat_shirts&size=M&sort=newest")
    renderControls()

    await userEvent.click(screen.getByRole("button", { name: "Clear all" }))

    const url = pushMock.mock.calls[0][0] as string
    expect(url).not.toContain("category=")
    expect(url).not.toContain("size=")
    expect(url).toContain("sort=newest")
  })

  test("the mobile filter trigger opens a drawer with a close button", async () => {
    renderControls()

    await userEvent.click(screen.getByRole("button", { name: "Filters" }))

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
  })
})
