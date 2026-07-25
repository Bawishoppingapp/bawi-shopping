import { resolvePublicBrand } from "../public-brand"

describe("resolvePublicBrand", () => {
  test("returns the seller's real name when public display is approved", () => {
    expect(
      resolvePublicBrand({ name: "Luna Boutique", public_brand_display_approved: true })
    ).toBe("Luna Boutique")
  })

  test("returns a generic label when public display is not approved", () => {
    expect(
      resolvePublicBrand({ name: "Luna Boutique", public_brand_display_approved: false })
    ).toBe("Bawi Shopping Seller")
  })

  test("never leaks the real name through the generic label", () => {
    const result = resolvePublicBrand({
      name: "Secret Vendor LLC",
      public_brand_display_approved: false,
    })
    expect(result).not.toContain("Secret Vendor")
  })
})
