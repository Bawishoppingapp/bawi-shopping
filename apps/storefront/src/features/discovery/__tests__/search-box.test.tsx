import { describe, expect, test, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SearchBox } from "../components/search-box"

const pushMock = vi.fn()
let currentSearchParams = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => currentSearchParams,
}))

describe("SearchBox", () => {
  beforeEach(() => {
    pushMock.mockClear()
    currentSearchParams = new URLSearchParams()
  })

  test("renders a labeled search input with the given placeholder", () => {
    render(<SearchBox placeholder="Search products" />)
    expect(screen.getByPlaceholderText("Search products")).toBeInTheDocument()
  })

  test("submitting a query navigates to /search with the q param", async () => {
    render(<SearchBox placeholder="Search products" />)

    const input = screen.getByPlaceholderText("Search products")
    await userEvent.type(input, "denim jacket")
    await userEvent.type(input, "{Enter}")

    expect(pushMock).toHaveBeenCalledTimes(1)
    const url = pushMock.mock.calls[0][0] as string
    expect(url).toContain("/search?")
    expect(new URLSearchParams(url.split("?")[1]).get("q")).toBe("denim jacket")
  })

  test("submitting an empty query removes the q param instead of sending an empty one", async () => {
    currentSearchParams = new URLSearchParams("q=old-query&sort=newest")
    render(<SearchBox placeholder="Search products" />)

    const input = screen.getByPlaceholderText("Search products")
    await userEvent.clear(input)
    await userEvent.type(input, "{Enter}")

    const url = pushMock.mock.calls[0][0] as string
    expect(url).not.toContain("q=")
    expect(url).toContain("sort=newest")
  })
})
