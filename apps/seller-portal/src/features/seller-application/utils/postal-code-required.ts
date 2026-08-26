// Mirrors apps/backend/src/orders/postal-code-required.ts and the
// identical helper in apps/storefront/apps/mobile-customer - small,
// scoped duplication per app rather than a shared package for something
// this small (see this project's existing precedent).
const COUNTRIES_WITHOUT_POSTAL_CODE = new Set([
  "et", // Ethiopia
  "ie", // Ireland
  "ke", // Kenya
  "so", // Somalia
  "er", // Eritrea
  "dj", // Djibouti
  "sd", // Sudan
  "ug", // Uganda
  "tz", // Tanzania
  "ng", // Nigeria
  "gh", // Ghana
  "sa", // Saudi Arabia
  "ae", // United Arab Emirates
  "qa", // Qatar
  "jm", // Jamaica
])

export function isPostalCodeRequired(countryCode: string): boolean {
  return !COUNTRIES_WITHOUT_POSTAL_CODE.has(countryCode.toLowerCase())
}
