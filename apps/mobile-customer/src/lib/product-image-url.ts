const BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const LEGACY_PREFIX = "http://localhost:9000/static/";

/** Medusa's default local provider saved a development host in older image rows. */
export function productImageUrl(url: string): string {
  return url.startsWith(LEGACY_PREFIX)
    ? `${BACKEND_URL.replace(/\/$/, "")}/static/${url.slice(LEGACY_PREFIX.length)}`
    : url;
}
