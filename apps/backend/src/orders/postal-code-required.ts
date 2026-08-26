// Whether a country's addressing model actually uses a postal code -
// mirrors apps/mobile-customer/src/features/addresses/data/countries.ts's
// `postalCodeRequired` field (small, scoped duplication, matching this
// project's existing precedent of duplicating small schemas per app
// rather than sharing a package for something this small - see
// register-schema.ts's own comment). Only the subset checkout actually
// needs to decide on; not every country in the mobile list is repeated
// here since checkout only branches on true/false, not name/phone-code.
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
