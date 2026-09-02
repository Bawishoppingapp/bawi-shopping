// A curated, extensible country list - not the full ISO-3166 set, but
// broad enough to not be US/Ethiopia-only, and trivial to extend (add a
// row, no code change needed anywhere that consumes this). Not every
// country uses a postal code the same way (or at all) - postalCodeRequired
// drives whether the address form treats it as required vs. optional,
// rather than assuming every country works like the US.
export interface Country {
  code: string; // ISO 3166-1 alpha-2, lowercase (matches Medusa's country_code convention)
  name: string;
  phoneCode: string; // e.g. "+1", shown as a placeholder hint, not enforced strictly
  postalCodeRequired: boolean;
}

export const COUNTRIES: Country[] = [
  { code: "us", name: "United States", phoneCode: "+1", postalCodeRequired: true },
  { code: "et", name: "Ethiopia", phoneCode: "+251", postalCodeRequired: false },
  { code: "ca", name: "Canada", phoneCode: "+1", postalCodeRequired: true },
  { code: "gb", name: "United Kingdom", phoneCode: "+44", postalCodeRequired: true },
  { code: "de", name: "Germany", phoneCode: "+49", postalCodeRequired: true },
  { code: "fr", name: "France", phoneCode: "+33", postalCodeRequired: true },
  { code: "it", name: "Italy", phoneCode: "+39", postalCodeRequired: true },
  { code: "es", name: "Spain", phoneCode: "+34", postalCodeRequired: true },
  { code: "nl", name: "Netherlands", phoneCode: "+31", postalCodeRequired: true },
  { code: "se", name: "Sweden", phoneCode: "+46", postalCodeRequired: true },
  { code: "no", name: "Norway", phoneCode: "+47", postalCodeRequired: true },
  { code: "ie", name: "Ireland", phoneCode: "+353", postalCodeRequired: false },
  { code: "ke", name: "Kenya", phoneCode: "+254", postalCodeRequired: false },
  { code: "so", name: "Somalia", phoneCode: "+252", postalCodeRequired: false },
  { code: "er", name: "Eritrea", phoneCode: "+291", postalCodeRequired: false },
  { code: "dj", name: "Djibouti", phoneCode: "+253", postalCodeRequired: false },
  { code: "sd", name: "Sudan", phoneCode: "+249", postalCodeRequired: false },
  { code: "ug", name: "Uganda", phoneCode: "+256", postalCodeRequired: false },
  { code: "tz", name: "Tanzania", phoneCode: "+255", postalCodeRequired: false },
  { code: "ng", name: "Nigeria", phoneCode: "+234", postalCodeRequired: false },
  { code: "gh", name: "Ghana", phoneCode: "+233", postalCodeRequired: false },
  { code: "za", name: "South Africa", phoneCode: "+27", postalCodeRequired: true },
  { code: "eg", name: "Egypt", phoneCode: "+20", postalCodeRequired: true },
  { code: "sa", name: "Saudi Arabia", phoneCode: "+966", postalCodeRequired: false },
  { code: "ae", name: "United Arab Emirates", phoneCode: "+971", postalCodeRequired: false },
  { code: "qa", name: "Qatar", phoneCode: "+974", postalCodeRequired: false },
  { code: "il", name: "Israel", phoneCode: "+972", postalCodeRequired: true },
  { code: "tr", name: "Turkey", phoneCode: "+90", postalCodeRequired: true },
  { code: "in", name: "India", phoneCode: "+91", postalCodeRequired: true },
  { code: "pk", name: "Pakistan", phoneCode: "+92", postalCodeRequired: true },
  { code: "cn", name: "China", phoneCode: "+86", postalCodeRequired: true },
  { code: "jp", name: "Japan", phoneCode: "+81", postalCodeRequired: true },
  { code: "kr", name: "South Korea", phoneCode: "+82", postalCodeRequired: true },
  { code: "sg", name: "Singapore", phoneCode: "+65", postalCodeRequired: true },
  { code: "au", name: "Australia", phoneCode: "+61", postalCodeRequired: true },
  { code: "nz", name: "New Zealand", phoneCode: "+64", postalCodeRequired: true },
  { code: "mx", name: "Mexico", phoneCode: "+52", postalCodeRequired: true },
  { code: "br", name: "Brazil", phoneCode: "+55", postalCodeRequired: true },
  { code: "ar", name: "Argentina", phoneCode: "+54", postalCodeRequired: true },
  { code: "co", name: "Colombia", phoneCode: "+57", postalCodeRequired: true },
  { code: "jm", name: "Jamaica", phoneCode: "+1876", postalCodeRequired: false },
  { code: "ph", name: "Philippines", phoneCode: "+63", postalCodeRequired: true },
  { code: "vn", name: "Vietnam", phoneCode: "+84", postalCodeRequired: true },
  { code: "th", name: "Thailand", phoneCode: "+66", postalCodeRequired: true },
  { code: "id", name: "Indonesia", phoneCode: "+62", postalCodeRequired: true },
];

export function findCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code.toLowerCase());
}

export function countryName(code: string | null | undefined, locale = "en-US"): string {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? findCountry(code)?.name ?? code.toUpperCase();
  } catch {
    return findCountry(code)?.name ?? code.toUpperCase();
  }
}
