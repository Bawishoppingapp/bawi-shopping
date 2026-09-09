import type { ShippingAddressInput } from "../orders/schemas"

const ADDIS_ALIASES = new Set(["addis ababa", "addis abeba", "finfinne", "finfine"])
const NEIGHBORING_ALIASES = new Set([
  "burayu", "sebeta", "sululta", "legetafo", "lege tafo", "legedadi", "lege dadi", "bishoftu", "debre zeyit", "debre zeit",
])

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en").replace(/[.,]/g, "").replace(/\s+/g, " ")
}

export function calculateAddressShipping(
  address: ShippingAddressInput,
  addisFee: number,
  neighboringFee: number
): { amount: number; zone: "addis_ababa" | "neighboring" } | null {
  if (address.country_code.toLowerCase() !== "et") return null
  const location = normalize(`${address.city} ${address.sub_city ?? ""}`)
  if ([...ADDIS_ALIASES].some((name) => location.includes(name))) {
    return { amount: addisFee, zone: "addis_ababa" }
  }
  if ([...NEIGHBORING_ALIASES].some((name) => location.includes(name))) {
    return { amount: neighboringFee, zone: "neighboring" }
  }
  return null
}
