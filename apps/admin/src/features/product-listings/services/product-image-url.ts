/** Existing Render uploads were saved with Medusa's development-only host. */
export function productImageUrl(url: string): string {
  const backendUrl = process.env.MEDUSA_BACKEND_URL
  if (!backendUrl || !/^http:\/\/localhost:9000\/static\//.test(url)) return url
  return `${backendUrl.replace(/\/$/, "")}/static/${url.slice("http://localhost:9000/static/".length)}`
}
