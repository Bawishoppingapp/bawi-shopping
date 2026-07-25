type CategoryNode = { id: string; parent_category_id: string | null }

/**
 * True if setting `categoryId`'s parent to `candidateParentId` would create
 * a cycle (the category becoming its own ancestor) - walks up the
 * candidate's own ancestor chain looking for `categoryId`.
 */
export function wouldCreateCycle(
  categoryId: string,
  candidateParentId: string,
  allCategories: CategoryNode[]
): boolean {
  if (categoryId === candidateParentId) {
    return true
  }
  const byId = new Map(allCategories.map((category) => [category.id, category]))
  let current: string | null = candidateParentId
  const visited = new Set<string>()
  while (current) {
    if (current === categoryId) {
      return true
    }
    if (visited.has(current)) {
      // Pre-existing cycle unrelated to this change - not this function's
      // job to fix, just don't loop forever.
      return false
    }
    visited.add(current)
    current = byId.get(current)?.parent_category_id ?? null
  }
  return false
}

export function buildCategoryTree<T extends { id: string; parent_category_id: string | null }>(
  categories: T[]
): (T & { children: unknown[] })[] {
  const nodes = new Map(categories.map((category) => [category.id, { ...category, children: [] as unknown[] }]))
  const roots: (T & { children: unknown[] })[] = []

  for (const node of nodes.values()) {
    if (node.parent_category_id && nodes.has(node.parent_category_id)) {
      nodes.get(node.parent_category_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}
