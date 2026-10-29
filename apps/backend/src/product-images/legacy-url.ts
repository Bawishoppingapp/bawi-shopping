const LEGACY_PREFIX = "http://localhost:9000/static/"

/** Older local-provider uploads persisted a development URL in product rows. */
export function resolveProductImageUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const publicBase = process.env.S3_FILE_URL?.replace(/\/$/, "")
  return publicBase && url.startsWith(LEGACY_PREFIX)
    ? `${publicBase}/${url.slice(LEGACY_PREFIX.length)}`
    : url
}
