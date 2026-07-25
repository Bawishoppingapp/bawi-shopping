// A vendor's own store name/brand is private by default - only Bawi admin
// approval (seller.public_brand_display_approved) makes it publicly
// displayable (see docs/DECISIONS.md, CLAUDE.md). Every public-facing
// response that would otherwise surface a seller's name must resolve it
// through this function instead of reading seller.name directly.
const UNAPPROVED_BRAND_LABEL = "Bawi Shopping Seller"

export function resolvePublicBrand(seller: {
  name: string
  public_brand_display_approved: boolean
}): string {
  return seller.public_brand_display_approved ? seller.name : UNAPPROVED_BRAND_LABEL
}
