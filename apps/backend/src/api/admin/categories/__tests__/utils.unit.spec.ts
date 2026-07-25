import { wouldCreateCycle, buildCategoryTree } from "../utils"

describe("wouldCreateCycle", () => {
  const categories = [
    { id: "a", parent_category_id: null },
    { id: "b", parent_category_id: "a" },
    { id: "c", parent_category_id: "b" },
    { id: "d", parent_category_id: null },
  ]

  test("a category cannot become its own parent", () => {
    expect(wouldCreateCycle("a", "a", categories)).toBe(true)
  })

  test("a category cannot be moved under its direct child", () => {
    // a -> b already; moving a under b would create a <-> b
    expect(wouldCreateCycle("a", "b", categories)).toBe(true)
  })

  test("a category cannot be moved under a grandchild", () => {
    // a -> b -> c; moving a under c would create a cycle
    expect(wouldCreateCycle("a", "c", categories)).toBe(true)
  })

  test("moving a leaf under an unrelated top-level category is allowed", () => {
    expect(wouldCreateCycle("c", "d", categories)).toBe(false)
  })

  test("moving a category under its current parent is allowed (no-op)", () => {
    expect(wouldCreateCycle("b", "a", categories)).toBe(false)
  })

  test("moving an unrelated top-level category under a leaf is allowed", () => {
    expect(wouldCreateCycle("d", "c", categories)).toBe(false)
  })
})

describe("buildCategoryTree", () => {
  test("nests children under their parent", () => {
    const flat = [
      { id: "a", parent_category_id: null, name: "A" },
      { id: "b", parent_category_id: "a", name: "B" },
      { id: "c", parent_category_id: "a", name: "C" },
    ]
    const tree = buildCategoryTree(flat)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe("a")
    expect((tree[0].children as { id: string }[]).map((c) => c.id).sort()).toEqual(["b", "c"])
  })

  test("treats a category whose parent is missing as top-level", () => {
    const flat = [{ id: "orphan", parent_category_id: "does-not-exist", name: "Orphan" }]
    const tree = buildCategoryTree(flat)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe("orphan")
  })

  test("supports multiple levels of nesting", () => {
    const flat = [
      { id: "a", parent_category_id: null, name: "A" },
      { id: "b", parent_category_id: "a", name: "B" },
      { id: "c", parent_category_id: "b", name: "C" },
    ]
    const tree = buildCategoryTree(flat)
    const a = tree[0] as { children: { id: string; children: { id: string }[] }[] }
    expect(a.children[0].id).toBe("b")
    expect(a.children[0].children[0].id).toBe("c")
  })

  test("returns an empty array for no categories", () => {
    expect(buildCategoryTree([])).toEqual([])
  })
})
