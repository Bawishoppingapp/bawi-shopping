import { readFile } from "node:fs/promises"
import path from "node:path"
import { renderMarkdownLite } from "../markdown-lite"

/**
 * Renders one of the published legal policies. The source file is
 * read from apps/storefront/public/legal/ (not docs/legal/ directly) so
 * this works identically in the production Docker image, where only
 * public/ is copied into the standalone runtime - see
 * apps/storefront/Dockerfile and docs/legal/README.md.
 */
export async function LegalDocumentPage({ filename }: { filename: string }) {
  const filePath = path.join(process.cwd(), "public", "legal", filename)
  const source = await readFile(filePath, "utf-8")

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <article className="prose prose-neutral max-w-none">{renderMarkdownLite(source)}</article>
    </main>
  )
}
