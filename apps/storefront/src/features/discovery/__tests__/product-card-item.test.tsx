import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProductCardItem } from "../components/product-card-item"
import type { ProductHit } from "../services/discovery-client"

function hit(overrides: Partial<ProductHit> = {}): ProductHit {
  return {
    productCode: "BW-ABC123",
    title: "Denim Jacket",
    brand: "Acme Co",
    thumbnail: "https://example.test/jacket.jpg",
    priceMin: 4999,
    priceMax: 4999,
    currencyCode: "usd",
    available: true,
    categoryIds: ["cat_1"],
    ...overrides,
  }
}

describe("ProductCardItem", () => {
  test("renders title, brand, and a single formatted price", () => {
    render(<ProductCardItem item={hit()} soldOutLabel="Sold out" />)
    expect(screen.getByText("Denim Jacket")).toBeInTheDocument()
    expect(screen.getByText("Acme Co")).toBeInTheDocument()
    expect(screen.getByText("$49.99")).toBeInTheDocument()
  })

  test("renders a price range when variants differ in price", () => {
    render(<ProductCardItem item={hit({ priceMin: 2000, priceMax: 5000 })} soldOutLabel="Sold out" />)
    expect(screen.getByText("$20.00 – $50.00")).toBeInTheDocument()
  })

  test("renders an ETB-priced product in Birr, not dollars", () => {
    render(
      <ProductCardItem item={hit({ priceMin: 250000, priceMax: 250000, currencyCode: "etb" })} soldOutLabel="Sold out" />
    )
    expect(screen.getByText("Br 2,500")).toBeInTheDocument()
  })

  test("shows the sold-out badge when unavailable", () => {
    render(<ProductCardItem item={hit({ available: false })} soldOutLabel="Sold out" />)
    expect(screen.getByText("Sold out")).toBeInTheDocument()
  })

  test("does not show the sold-out badge when in stock", () => {
    render(<ProductCardItem item={hit({ available: true })} soldOutLabel="Sold out" />)
    expect(screen.queryByText("Sold out")).not.toBeInTheDocument()
  })

  test("links to the product's public detail page by product code", () => {
    render(<ProductCardItem item={hit({ productCode: "BW-XYZ999" })} soldOutLabel="Sold out" />)
    expect(screen.getByRole("link")).toHaveAttribute("href", "/products/BW-XYZ999")
  })
})
