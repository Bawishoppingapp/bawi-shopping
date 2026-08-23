// Mirrors apps/backend/src/orders/postal-code-required.ts and
// apps/mobile-customer/src/features/addresses/data/countries.ts's
// `postalCodeRequired` field - small, scoped duplication per app rather
// than a shared package for something this small (see this project's
// existing precedent, e.g. register-schema.ts's own comment).
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
