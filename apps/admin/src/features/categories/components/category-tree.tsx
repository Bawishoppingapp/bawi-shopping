import Link from "next/link"
import { StatusBadge } from "@bawi/ui"
import type { CategoryNode } from "../services/categories-client"

export function CategoryTree({ categories }: { categories: CategoryNode[] }) {
  if (!categories.length) {
    return (
      <p className="rounded-md border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
        No categories yet. Create the first one above.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {categories.map((category) => (
        <CategoryTreeNode key={category.id} category={category} depth={0} />
      ))}
    </ul>
  )
}

function CategoryTreeNode({ category, depth }: { category: CategoryNode; depth: number }) {
  return (
    <li>
      <div
        className="flex items-center justify-between gap-3 rounded-md border border-neutral-100 px-3 py-2"
        style={{ marginLeft: depth * 20 }}
      >
        <Link
          href={`/categories/${category.id}`}
          className="font-medium text-neutral-900 underline-offset-2 hover:underline"
        >
          {category.name}
        </Link>
        <div className="flex items-center gap-2">
          {!category.is_active && <StatusBadge status="archived" />}
          <span className="text-xs text-neutral-400">{category.handle}</span>
        </div>
      </div>
      {category.children.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1">
          {category.children.map((child) => (
            <CategoryTreeNode key={child.id} category={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
