import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class CategoriesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CategoriesError"
  }
}

async function parseJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

export interface CategoryNode {
  id: string
  name: string
  handle: string
  parent_category_id: string | null
  is_active: boolean
  translations: Record<string, string>
  children: CategoryNode[]
}

export async function listCategories(sessionToken: string): Promise<CategoryNode[]> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/categories`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })
  if (!response.ok) {
    throw new CategoriesError("Could not load categories")
  }
  const data = await parseJson(response)
  return data.categories as CategoryNode[]
}

export interface CategoryDetail {
  id: string
  name: string
  handle: string
  parent_category_id: string | null
  is_active: boolean
  translations: Record<string, string>
}

export async function getCategory(
  sessionToken: string,
  id: string
): Promise<CategoryDetail> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/categories/${id}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })
  if (!response.ok) {
    throw new CategoriesError("Category not found")
  }
  const data = await parseJson(response)
  return data.category as CategoryDetail
}

export interface CategoryInput {
  name: string
  parent_category_id: string | null
  is_active: boolean
  translations: Record<string, string>
}

export async function createCategory(
  sessionToken: string,
  input: CategoryInput
): Promise<void> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/categories`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const data = await parseJson(response)
    throw new CategoriesError(data.message || "Could not create category")
  }
}

export async function updateCategory(
  sessionToken: string,
  id: string,
  input: Partial<CategoryInput>
): Promise<void> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/categories/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const data = await parseJson(response)
    throw new CategoriesError(data.message || "Could not update category")
  }
}

export function flattenWithDepth(
  categories: CategoryNode[],
  depth = 0
): { id: string; name: string; depth: number }[] {
  return categories.flatMap((category) => [
    { id: category.id, name: category.name, depth },
    ...flattenWithDepth(category.children, depth + 1),
  ])
}

function collectSubtreeIds(category: CategoryNode): string[] {
  return [category.id, ...category.children.flatMap(collectSubtreeIds)]
}

/** Valid parent choices for editing `excludeId` - itself and its own
 * descendants are excluded so the UI can't even offer a cycle-creating
 * choice (the API still re-validates this server-side). */
export function parentOptionsExcluding(
  categories: CategoryNode[],
  excludeId: string
): { id: string; name: string; depth: number }[] {
  const excluded = new Set<string>()
  const excludeSelf = (nodes: CategoryNode[]) => {
    for (const node of nodes) {
      if (node.id === excludeId) {
        for (const id of collectSubtreeIds(node)) excluded.add(id)
      } else {
        excludeSelf(node.children)
      }
    }
  }
  excludeSelf(categories)
  return flattenWithDepth(categories).filter((option) => !excluded.has(option.id))
}

export async function deleteCategory(sessionToken: string, id: string): Promise<void> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/categories/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${sessionToken}` },
  })
  if (!response.ok) {
    const data = await parseJson(response)
    throw new CategoriesError(data.message || "Could not delete category")
  }
}
