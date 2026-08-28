/**
 * Splits a list into 2 staggered columns with varied card heights - a
 * plain, deterministic layout rather than FlashList v2's native `masonry`
 * prop (new-architecture-only, and this needs to work reliably inside a
 * plain vertical ScrollView alongside Home's other section types, not as
 * its own virtualized list). At the list sizes Home ever renders (a
 * couple dozen items at most), un-virtualized Views cost nothing worth
 * measuring - see docs/DECISIONS.md's Android-perf note in CLAUDE.md's
 * mobile section for why virtualization is reserved for the screens that
 * actually need it (search results, order history).
 */

// Cycled by index (not random) so a re-render or pull-to-refresh never
// reshuffles which cards are tall vs. square - stable, reproducible
// layout is worth more here than true randomness.
const ASPECT_RATIO_CYCLE = [4 / 5, 1, 3 / 4, 4 / 5, 1 / 1, 5 / 4];

export interface MasonryItem<T> {
  item: T;
  aspectRatio: number;
}

export interface MasonryColumns<T> {
  left: MasonryItem<T>[];
  right: MasonryItem<T>[];
}

/** Greedy height-balancing: each item goes to whichever column is
 * currently shorter (estimated from 1/aspectRatio, since both columns
 * share the same width). Good enough for the "staggered, not lopsided"
 * effect this is after - not aiming for a provably optimal partition. */
export function splitIntoMasonryColumns<T>(items: T[]): MasonryColumns<T> {
  const left: MasonryItem<T>[] = [];
  const right: MasonryItem<T>[] = [];
  let leftHeight = 0;
  let rightHeight = 0;

  items.forEach((item, index) => {
    const aspectRatio = ASPECT_RATIO_CYCLE[index % ASPECT_RATIO_CYCLE.length];
    const estimatedHeight = 1 / aspectRatio;
    if (leftHeight <= rightHeight) {
      left.push({ item, aspectRatio });
      leftHeight += estimatedHeight;
    } else {
      right.push({ item, aspectRatio });
      rightHeight += estimatedHeight;
    }
  });

  return { left, right };
}
