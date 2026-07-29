import type { ReactNode } from "react"

/**
 * A tiny, dependency-free renderer for exactly the markdown subset used by
 * docs/legal/*.md (headers, bold, links, blockquotes, tables, lists,
 * paragraphs) - not a general-purpose markdown parser. Avoids adding a
 * markdown-library dependency for content that's explicitly a draft
 * pending attorney review and will be replaced before real launch (see
 * docs/legal/README.md).
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{match[1]}</strong>)
    } else {
      nodes.push(
        <a key={`${keyPrefix}-a-${i}`} href={match[3]} className="underline">
          {match[2]}
        </a>
      )
    }
    lastIndex = pattern.lastIndex
    i += 1
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|")
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s|:-]+\|$/.test(line.trim())
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim())
}

export function renderMarkdownLite(source: string): ReactNode {
  const lines = source.split("\n")
  const blocks: ReactNode[] = []
  let paragraphBuffer: string[] = []
  let listBuffer: string[] = []
  let key = 0

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return
    const text = paragraphBuffer.join(" ")
    blocks.push(
      <p key={`p-${key++}`} className="mb-4 leading-relaxed">
        {renderInline(text, `p-${key}`)}
      </p>
    )
    paragraphBuffer = []
  }

  function flushList() {
    if (listBuffer.length === 0) return
    blocks.push(
      <ul key={`ul-${key++}`} className="mb-4 list-disc space-y-1 pl-6">
        {listBuffer.map((item, i) => (
          <li key={`li-${key}-${i}`}>{renderInline(item, `li-${key}-${i}`)}</li>
        ))}
      </ul>
    )
    listBuffer = []
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    if (line.trim() === "") {
      flushParagraph()
      flushList()
      i += 1
      continue
    }

    const headerMatch = /^(#{1,3})\s+(.*)$/.exec(line)
    if (headerMatch) {
      flushParagraph()
      flushList()
      const level = headerMatch[1].length
      const text = headerMatch[2]
      const className =
        level === 1
          ? "mt-8 mb-4 text-2xl font-semibold first:mt-0"
          : level === 2
            ? "mt-6 mb-3 text-xl font-semibold"
            : "mt-5 mb-2 text-lg font-semibold"
      if (level === 1) {
        blocks.push(
          <h1 key={`h-${key++}`} className={className}>
            {renderInline(text, `h-${key}`)}
          </h1>
        )
      } else if (level === 2) {
        blocks.push(
          <h2 key={`h-${key++}`} className={className}>
            {renderInline(text, `h-${key}`)}
          </h2>
        )
      } else {
        blocks.push(
          <h3 key={`h-${key++}`} className={className}>
            {renderInline(text, `h-${key}`)}
          </h3>
        )
      }
      i += 1
      continue
    }

    if (line.trim().startsWith(">")) {
      flushParagraph()
      flushList()
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""))
        i += 1
      }
      blocks.push(
        <blockquote
          key={`bq-${key++}`}
          className="mb-4 border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-neutral-800"
        >
          {renderInline(quoteLines.join(" "), `bq-${key}`)}
        </blockquote>
      )
      continue
    }

    if (isTableRow(line)) {
      flushParagraph()
      flushList()
      const rows: string[][] = []
      while (i < lines.length && isTableRow(lines[i])) {
        if (!isTableSeparator(lines[i])) {
          rows.push(parseTableRow(lines[i]))
        }
        i += 1
      }
      const [header, ...body] = rows
      blocks.push(
        <div key={`table-${key++}`} className="mb-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {header.map((cell, ci) => (
                  <th
                    key={`th-${key}-${ci}`}
                    className="border border-neutral-300 bg-neutral-100 px-3 py-2 text-left font-medium"
                  >
                    {renderInline(cell, `th-${key}-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={`tr-${key}-${ri}`}>
                  {row.map((cell, ci) => (
                    <td key={`td-${key}-${ri}-${ci}`} className="border border-neutral-300 px-3 py-2 align-top">
                      {renderInline(cell, `td-${key}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    const listMatch = /^\s*(?:-|\d+\.)\s+(.*)$/.exec(line)
    if (listMatch) {
      flushParagraph()
      listBuffer.push(listMatch[1])
      i += 1
      continue
    }

    paragraphBuffer.push(line.trim())
    i += 1
  }

  flushParagraph()
  flushList()

  return <>{blocks}</>
}
