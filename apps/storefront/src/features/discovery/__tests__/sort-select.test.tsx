import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SortSelect } from "../components/sort-select"

const pushMock = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/search",
  useSearchParams: () => currentSearchParams,
}))

describe("SortSelect", () => {
  beforeEach(() => {
    pushMock.mockClear()
    currentSearchParams = new URLSearchParams()
  })

  test("renders the three sort options", () => {
    render(
      <SortSelect
        label="Sort by"
        newestLabel="Newest"
        priceAscLabel="Price: Low to High"
        priceDescLabel="Price: High to Low"
      />
    )
    expect(screen.getByText("Newest")).toBeInTheDocument()
    expect(screen.getByText("Price: Low to High")).toBeInTheDocument()
    expect(screen.getByText("Price: High to Low")).toBeInTheDocument()
  })

  test("changing the sort navigates with the new sort param and clears the cursor", async () => {
    currentSearchParams = new URLSearchParams("cursor=xyz")
    render(
      <SortSelect
        label="Sort by"
        newestLabel="Newest"
        priceAscLabel="Price: Low to High"
        priceDescLabel="Price: High to Low"
      />
    )

    await userEvent.selectOptions(screen.getByRole("combobox"), "price_asc")

    expect(pushMock).toHaveBeenCalledTimes(1)
    const url = pushMock.mock.calls[0][0] as string
    expect(url).toContain("sort=price_asc")
    expect(url).not.toContain("cursor=")
  })
})
