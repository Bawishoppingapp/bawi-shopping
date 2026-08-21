import { Text, View } from "react-native";

// RN's Text/View children props resolve React's types from a different
// @types/react copy than this file's own import would pull in a
// monorepo with duplicate installs, producing a spurious "bigint is not
// assignable to ReactNode" error - same known false positive documented
// in features/i18n/hooks/use-locale.tsx. Returning `any` here (rather
// than the real ReactNode type) sidesteps the cross-package mismatch
// without disabling type checking anywhere else in this file.
type MarkdownNode = any;

/**
 * Native port of apps/storefront/src/features/legal/markdown-lite.tsx - a
 * tiny, dependency-free renderer for exactly the markdown subset used by
 * docs/legal/*.md (headers, bold, links, blockquotes, tables, lists,
 * paragraphs), swapping DOM tags for RN Text/View. Not a general-purpose
 * markdown parser - avoids adding a markdown-library dependency for
 * content that's explicitly a draft pending attorney review (see
 * docs/legal/README.md).
 */

function renderInline(text: string, keyPrefix: string): MarkdownNode {
  const nodes: MarkdownNode[] = [];
  const pattern = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      nodes.push(
        <Text key={`${keyPrefix}-b-${i}`} className="font-semibold">
          {match[1]}
        </Text>
      );
    } else {
      // Links in legal drafts point at other legal pages / mailto addresses,
      // not something worth making tappable inside a bundled draft screen -
      // rendered as plain underlined text.
      nodes.push(
        <Text key={`${keyPrefix}-a-${i}`} className="underline">
          {match[2]}
        </Text>
      );
    }
    lastIndex = pattern.lastIndex;
    i += 1;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return <>{nodes}</>;
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s|:-]+\|$/.test(line.trim());
}

function parseTableRow(line: string): string[] {
  return line.trim().slice(1, -1).split("|").map((cell) => cell.trim());
}

export function renderMarkdownLite(source: string): MarkdownNode {
  const lines = source.split("\n");
  const blocks: MarkdownNode[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(" ");
    blocks.push(
      <Text key={`p-${key++}`} className="mb-4 text-body text-ink-800">
        {renderInline(text, `p-${key}`)}
      </Text>
    );
    paragraphBuffer = [];
  }

  function flushList() {
    if (listBuffer.length === 0) return;
    blocks.push(
      <View key={`ul-${key++}`} className="mb-4 gap-1">
        {listBuffer.map((item, i) => (
          <View key={`li-${key}-${i}`} className="flex-row gap-2">
            <Text className="text-body text-ink-800">{"•"}</Text>
            <Text className="flex-1 text-body text-ink-800">{renderInline(item, `li-${key}-${i}`)}</Text>
          </View>
        ))}
      </View>
    );
    listBuffer = [];
  }

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      i += 1;
      continue;
    }

    const headerMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (headerMatch) {
      flushParagraph();
      flushList();
      const level = headerMatch[1].length;
      const text = headerMatch[2];
      const className =
        level === 1
          ? "mb-4 mt-2 text-h1 text-ink-950"
          : level === 2
            ? "mb-3 mt-6 text-h2 text-ink-950"
            : "mb-2 mt-5 text-h3 text-ink-950";
      blocks.push(
        <Text key={`h-${key++}`} className={className}>
          {renderInline(text, `h-${key}`)}
        </Text>
      );
      i += 1;
      continue;
    }

    if (line.trim().startsWith(">")) {
      flushParagraph();
      flushList();
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <View key={`bq-${key++}`} className="mb-4 border-l-4 border-gold-500 bg-gold-100 px-4 py-3">
          <Text className="text-body-sm text-ink-800">{renderInline(quoteLines.join(" "), `bq-${key}`)}</Text>
        </View>
      );
      continue;
    }

    if (isTableRow(line)) {
      flushParagraph();
      flushList();
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) {
        if (!isTableSeparator(lines[i])) {
          rows.push(parseTableRow(lines[i]));
        }
        i += 1;
      }
      const [header, ...body] = rows;
      blocks.push(
        <View key={`table-${key++}`} className="mb-4 overflow-hidden rounded-md border border-ink-200">
          <View className="flex-row bg-ink-100">
            {header.map((cell, ci) => (
              <View key={`th-${key}-${ci}`} className="flex-1 border-r border-ink-200 px-3 py-2 last:border-r-0">
                <Text className="text-caption font-semibold text-ink-950">
                  {renderInline(cell, `th-${key}-${ci}`)}
                </Text>
              </View>
            ))}
          </View>
          {body.map((row, ri) => (
            <View key={`tr-${key}-${ri}`} className="flex-row border-t border-ink-200">
              {row.map((cell, ci) => (
                <View key={`td-${key}-${ri}-${ci}`} className="flex-1 border-r border-ink-200 px-3 py-2 last:border-r-0">
                  <Text className="text-caption text-ink-800">{renderInline(cell, `td-${key}-${ri}-${ci}`)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
      continue;
    }

    const listMatch = /^\s*(?:-|\d+\.)\s+(.*)$/.exec(line);
    if (listMatch) {
      flushParagraph();
      listBuffer.push(listMatch[1]);
      i += 1;
      continue;
    }

    paragraphBuffer.push(line.trim());
    i += 1;
  }

  flushParagraph();
  flushList();

  return <>{blocks}</>;
}
