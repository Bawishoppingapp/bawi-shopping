// Ethiopian mobile numbers only - every other country's phone field stays
// free-text (see address-schema.ts's comment) since building a real
// validator for 40+ countries is out of scope; Ethiopia is the one this
// phase specifically needs to get right.
//
// Accepts local (09XXXXXXXX, 07XXXXXXXX) or already-international
// (+2519XXXXXXXX, +2517XXXXXXXX) input and normalizes to +251XXXXXXXXX
// for storage - Ethiopian mobile numbers are a 9-digit subscriber number
// starting with 9 (most carriers) or 7 (Safaricom Ethiopia), after the
// leading 0 or +251 is stripped.
const ETHIOPIAN_MOBILE_PATTERN = /^(?:\+251|0)?([97]\d{8})$/

export function isValidEthiopianPhone(value: string): boolean {
  return ETHIOPIAN_MOBILE_PATTERN.test(value.replace(/[\s-]/g, ""))
}

export function normalizeEthiopianPhone(value: string): string {
  const match = ETHIOPIAN_MOBILE_PATTERN.exec(value.replace(/[\s-]/g, ""))
  return match ? `+251${match[1]}` : value
}
