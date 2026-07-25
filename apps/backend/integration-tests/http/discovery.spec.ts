import { execFileSync } from "node:child_process"
import path from "node:path"
import { Client } from "pg"
import { startTestServer, stopTestServer, PORT } from "./test-server"

jest.setTimeout(180 * 1000)

const BASE_URL = `http://localhost:${PORT}`
const BACKEND_ROOT = path.resolve(__dirname, "../..")
const TEST_DATABASE_URL =
  "postgresql://bawishopping@127.0.0.1:5544/bawi_shopping_test"

async function post(path: string, body?: unknown, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

async function get(path: string, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return { status: response.status, data: await response.json() }
}

async function putRequest(path: string, body: unknown, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  return { status: response.status, data: await response.json() }
}

async function del(path: string, token?: string) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return { status: response.status, data: await response.json() }
}

function createAdmin(email: string, password: string) {
  execFileSync("npx", ["medusa", "user", "-e", email, "-p", password], {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "pipe",
  })
}

function validProductPayload(overrides: Record<string, unknown>, categoryId: string) {
  return {
    title: `Discovery Product ${Date.now()}-${Math.random()}`,
    description: "A product created for discovery integration testing.",
    category_id: categoryId,
    base_price: 5000,
    variants: [{ color: "Blue", size: "M", inventory_quantity: 10 }],
    ...overrides,
  }
}

describe("Category management, search, filtering, sorting, and approved-only visibility", () => {
  let serverProcess: Awaited<ReturnType<typeof startTestServer>>
  let dbClient: Client
  let adminToken: string
  let sellerToken: string
  let sellerSlug: string
  let baseCategoryId: string

  const suffix = Date.now()
  const adminEmail = `discovery-admin-${suffix}@example.test`
  const adminPassword = "correct-horse-battery-admin"

  beforeAll(async () => {
    createAdmin(adminEmail, adminPassword)
    serverProcess = await startTestServer()

    dbClient = new Client({ connectionString: TEST_DATABASE_URL })
    await dbClient.connect()

    const { rows } = await dbClient.query(
      "SELECT id FROM product_category WHERE deleted_at IS NULL LIMIT 1"
    )
    if (!rows.length) {
      throw new Error("No product category available for tests - seed data missing")
    }
    baseCategoryId = rows[0].id

    const adminLogin = await post("/auth/user/emailpass", {
      email: adminEmail,
      password: adminPassword,
    })
    adminToken = adminLogin.data.token

    sellerSlug = `discovery-seller-${suffix}`
    await post("/seller-test-support/provision", {
      name: `Discovery Seller ${suffix}`,
      slug: sellerSlug,
      email: `discovery-seller-${suffix}@example.test`,
      password: "correct-horse-battery-s",
    })
    const sellerLogin = await post("/auth/seller_user/emailpass", {
      email: `discovery-seller-${suffix}@example.test`,
      password: "correct-horse-battery-s",
    })
    sellerToken = sellerLogin.data.token
  })

  afterAll(async () => {
    await dbClient?.end()
    await stopTestServer(serverProcess)
  })

  async function createApprovedProduct(overrides: Record<string, unknown> = {}) {
    const created = await post(
      "/seller/products",
      validProductPayload(overrides, baseCategoryId),
      sellerToken
    )
    const listingId = created.data.listing.id
    await post(`/seller/products/${listingId}/submit`, undefined, sellerToken)
    await post(`/admin/product-listings/${listingId}/approve`, undefined, adminToken)
    return created.data
  }

  describe("admin category management", () => {
    test("an unauthenticated caller cannot create a category", async () => {
      const response = await post("/admin/categories", { name: "Nope" })
      expect(response.status).toBe(401)
    })

    test("admin can create a top-level category", async () => {
      const response = await post(
        "/admin/categories",
        { name: `Outerwear ${suffix}` },
        adminToken
      )
      expect(response.status).toBe(201)
      expect(response.data.category.parent_category_id).toBeNull()
    })

    test("admin can create a child category under a parent", async () => {
      const parent = await post(
        "/admin/categories",
        { name: `Parent ${suffix}` },
        adminToken
      )
      const child = await post(
        "/admin/categories",
        { name: `Child ${suffix}`, parent_category_id: parent.data.category.id },
        adminToken
      )
      expect(child.status).toBe(201)
      expect(child.data.category.parent_category_id).toBe(parent.data.category.id)

      const tree = await get("/admin/categories", adminToken)
      const parentNode = tree.data.categories.find(
        (c: { id: string }) => c.id === parent.data.category.id
      )
      expect(parentNode.children.map((c: { id: string }) => c.id)).toContain(
        child.data.category.id
      )
    })

    test("a category cannot be made its own parent", async () => {
      const created = await post(
        "/admin/categories",
        { name: `SelfParent ${suffix}` },
        adminToken
      )
      const response = await putRequest(
        `/admin/categories/${created.data.category.id}`,
        { parent_category_id: created.data.category.id },
        adminToken
      )
      expect(response.status).toBe(422)
    })

    test("a category cannot be moved under its own descendant", async () => {
      const parent = await post(
        "/admin/categories",
        { name: `CycleParent ${suffix}` },
        adminToken
      )
      const child = await post(
        "/admin/categories",
        { name: `CycleChild ${suffix}`, parent_category_id: parent.data.category.id },
        adminToken
      )
      const response = await putRequest(
        `/admin/categories/${parent.data.category.id}`,
        { parent_category_id: child.data.category.id },
        adminToken
      )
      expect(response.status).toBe(422)
    })

    test("admin can set and update translations, English falls back to the native name", async () => {
      const created = await post(
        "/admin/categories",
        { name: `Dresses ${suffix}`, translations: { es: "Vestidos", am: "ቀሚሶች" } },
        adminToken
      )
      const detail = await get(`/admin/categories/${created.data.category.id}`, adminToken)
      expect(detail.data.category.translations.es).toBe("Vestidos")
      expect(detail.data.category.translations.am).toBe("ቀሚሶች")
      expect(detail.data.category.translations["en-US"]).toBeUndefined()
    })

    test("a translation key outside the six supported locales is rejected", async () => {
      const response = await post(
        "/admin/categories",
        { name: `BadLocale ${suffix}`, translations: { fr: "Robes" } },
        adminToken
      )
      expect(response.status).toBe(400)
    })

    test("deleting a category with a child category is refused", async () => {
      const parent = await post(
        "/admin/categories",
        { name: `DeleteParent ${suffix}` },
        adminToken
      )
      await post(
        "/admin/categories",
        { name: `DeleteChild ${suffix}`, parent_category_id: parent.data.category.id },
        adminToken
      )
      const response = await del(`/admin/categories/${parent.data.category.id}`, adminToken)
      expect(response.status).toBe(409)
    })

    test("deleting a category with a product assigned is refused", async () => {
      const category = await post(
        "/admin/categories",
        { name: `ProductCategory ${suffix}` },
        adminToken
      )
      await post(
        "/seller/products",
        validProductPayload({}, category.data.category.id),
        sellerToken
      )
      const response = await del(`/admin/categories/${category.data.category.id}`, adminToken)
      expect(response.status).toBe(409)
    })

    test("an empty leaf category can be deleted", async () => {
      const created = await post(
        "/admin/categories",
        { name: `Deletable ${suffix}` },
        adminToken
      )
      const response = await del(`/admin/categories/${created.data.category.id}`, adminToken)
      expect(response.status).toBe(200)

      const afterDelete = await get(`/admin/categories/${created.data.category.id}`, adminToken)
      expect(afterDelete.status).toBe(404)
    })
  })

  describe("public category browsing", () => {
    test("only active categories are returned", async () => {
      const created = await post(
        "/admin/categories",
        { name: `Inactive ${suffix}`, is_active: false },
        adminToken
      )
      const response = await get("/categories")
      const ids = flattenIds(response.data.categories)
      expect(ids).not.toContain(created.data.category.id)
    })

    test("a translated name is returned for a locale that has one, falling back to English otherwise", async () => {
      const created = await post(
        "/admin/categories",
        { name: `Footwear ${suffix}`, translations: { es: "Calzado" } },
        adminToken
      )
      const spanish = await get("/categories?locale=es")
      const englishFallback = await get("/categories?locale=am")

      const spanishNode = findById(spanish.data.categories, created.data.category.id)
      const fallbackNode = findById(englishFallback.data.categories, created.data.category.id)

      expect(spanishNode?.name).toBe("Calzado")
      expect(fallbackNode?.name).toBe(`Footwear ${suffix}`)
    })

    function flattenIds(nodes: { id: string; children: unknown[] }[]): string[] {
      return nodes.flatMap((n) => [n.id, ...flattenIds(n.children as typeof nodes)])
    }
    function findById(
      nodes: { id: string; name: string; children: unknown[] }[],
      id: string
    ): { id: string; name: string; children: unknown[] } | undefined {
      for (const node of nodes) {
        if (node.id === id) return node
        const found = findById(node.children as typeof nodes, id)
        if (found) return found
      }
      return undefined
    }
  })

  describe("public product discovery: approved-only visibility", () => {
    test("draft, pending_review, and rejected listings never appear in search results", async () => {
      const draft = await post(
        "/seller/products",
        validProductPayload({ title: `Draft Item ${suffix}` }, baseCategoryId),
        sellerToken
      )

      const pending = await post(
        "/seller/products",
        validProductPayload({ title: `Pending Item ${suffix}` }, baseCategoryId),
        sellerToken
      )
      await post(`/seller/products/${pending.data.listing.id}/submit`, undefined, sellerToken)

      const rejected = await post(
        "/seller/products",
        validProductPayload({ title: `Rejected Item ${suffix}` }, baseCategoryId),
        sellerToken
      )
      await post(`/seller/products/${rejected.data.listing.id}/submit`, undefined, sellerToken)
      await post(
        `/admin/product-listings/${rejected.data.listing.id}/reject`,
        { reason: "Not for discovery test" },
        adminToken
      )

      const results = await get(`/products?q=${encodeURIComponent(suffix.toString())}`)
      const codes = results.data.products.map((p: { productCode: string }) => p.productCode)

      expect(codes).not.toContain(draft.data.listing.product_code)
      expect(codes).not.toContain(pending.data.listing.product_code)
      expect(codes).not.toContain(rejected.data.listing.product_code)
    })

    test("an approved listing appears in search results", async () => {
      const approved = await createApprovedProduct({ title: `Findable ${suffix}` })
      const results = await get(`/products?q=${encodeURIComponent(`Findable ${suffix}`)}`)
      const codes = results.data.products.map((p: { productCode: string }) => p.productCode)
      expect(codes).toContain(approved.listing.product_code)
    })

    test("the response never includes vendor_id or a private SKU", async () => {
      await createApprovedProduct({ title: `NoLeak ${suffix}` })
      const results = await get(`/products?q=${encodeURIComponent(`NoLeak ${suffix}`)}`)
      const serialized = JSON.stringify(results.data)
      expect(serialized).not.toContain("vendor_id")
      expect(serialized).not.toMatch(/"sku"/)
    })
  })

  describe("public product discovery: filtering, sorting, pagination", () => {
    test("filters by category", async () => {
      const category = await post(
        "/admin/categories",
        { name: `FilterCategory ${suffix}` },
        adminToken
      )
      const inCategory = await createApprovedProduct({
        title: `InCategory ${suffix}`,
        category_id: category.data.category.id,
      })
      await createApprovedProduct({ title: `OutOfCategory ${suffix}` })

      const results = await get(`/products?category=${category.data.category.id}`)
      const codes = results.data.products.map((p: { productCode: string }) => p.productCode)
      expect(codes).toEqual([inCategory.listing.product_code])
    })

    test("filters by brand (seller slug)", async () => {
      const otherSlug = `discovery-other-seller-${suffix}`
      await post("/seller-test-support/provision", {
        name: `Discovery Other Seller ${suffix}`,
        slug: otherSlug,
        email: `discovery-other-${suffix}@example.test`,
        password: "correct-horse-battery-o",
      })
      const otherLogin = await post("/auth/seller_user/emailpass", {
        email: `discovery-other-${suffix}@example.test`,
        password: "correct-horse-battery-o",
      })
      const otherToken = otherLogin.data.token

      const mine = await createApprovedProduct({ title: `MineBrand ${suffix}` })

      const otherCreated = await post(
        "/seller/products",
        validProductPayload({ title: `OtherBrand ${suffix}` }, baseCategoryId),
        otherToken
      )
      await post(`/seller/products/${otherCreated.data.listing.id}/submit`, undefined, otherToken)
      await post(
        `/admin/product-listings/${otherCreated.data.listing.id}/approve`,
        undefined,
        adminToken
      )

      const results = await get(`/products?brand=${sellerSlug}`)
      const codes = results.data.products.map((p: { productCode: string }) => p.productCode)
      expect(codes).toContain(mine.listing.product_code)
      expect(codes).not.toContain(otherCreated.data.listing.product_code)
    })

    test("filters by size and color", async () => {
      const redSmall = await createApprovedProduct({
        title: `RedSmall ${suffix}`,
        variants: [{ color: "Red", size: "S", inventory_quantity: 5 }],
      })
      const blueLarge = await createApprovedProduct({
        title: `BlueLarge ${suffix}`,
        variants: [{ color: "Blue", size: "L", inventory_quantity: 5 }],
      })

      const bySize = await get("/products?size=S")
      const bySizeCodes = bySize.data.products.map((p: { productCode: string }) => p.productCode)
      expect(bySizeCodes).toContain(redSmall.listing.product_code)
      expect(bySizeCodes).not.toContain(blueLarge.listing.product_code)

      const byColor = await get("/products?color=Blue")
      const byColorCodes = byColor.data.products.map((p: { productCode: string }) => p.productCode)
      expect(byColorCodes).toContain(blueLarge.listing.product_code)
      expect(byColorCodes).not.toContain(redSmall.listing.product_code)
    })

    test("filters by price range", async () => {
      const cheap = await createApprovedProduct({ title: `Cheap ${suffix}`, base_price: 1000 })
      const expensive = await createApprovedProduct({
        title: `Expensive ${suffix}`,
        base_price: 9000,
      })

      const results = await get("/products?price_min=500&price_max=2000")
      const codes = results.data.products.map((p: { productCode: string }) => p.productCode)
      expect(codes).toContain(cheap.listing.product_code)
      expect(codes).not.toContain(expensive.listing.product_code)
    })

    test("filters by availability", async () => {
      const inStock = await createApprovedProduct({
        title: `InStock ${suffix}`,
        variants: [{ color: "Green", size: "M", inventory_quantity: 3 }],
      })
      const outOfStock = await createApprovedProduct({
        title: `OutOfStock ${suffix}`,
        variants: [{ color: "Yellow", size: "M", inventory_quantity: 0 }],
      })

      const results = await get("/products?available=true")
      const codes = results.data.products.map((p: { productCode: string }) => p.productCode)
      expect(codes).toContain(inStock.listing.product_code)
      expect(codes).not.toContain(outOfStock.listing.product_code)
    })

    test("sorts by price ascending and descending", async () => {
      const category = await post(
        "/admin/categories",
        { name: `SortCategory ${suffix}` },
        adminToken
      )
      const low = await createApprovedProduct({
        title: `Low ${suffix}`,
        category_id: category.data.category.id,
        base_price: 1000,
      })
      const high = await createApprovedProduct({
        title: `High ${suffix}`,
        category_id: category.data.category.id,
        base_price: 9000,
      })

      const asc = await get(`/products?category=${category.data.category.id}&sort=price_asc`)
      expect(asc.data.products[0].productCode).toBe(low.listing.product_code)
      expect(asc.data.products[1].productCode).toBe(high.listing.product_code)

      const desc = await get(`/products?category=${category.data.category.id}&sort=price_desc`)
      expect(desc.data.products[0].productCode).toBe(high.listing.product_code)
      expect(desc.data.products[1].productCode).toBe(low.listing.product_code)
    })

    test("cursor-based pagination returns every item exactly once across pages", async () => {
      const category = await post(
        "/admin/categories",
        { name: `PageCategory ${suffix}` },
        adminToken
      )
      const created: Awaited<ReturnType<typeof createApprovedProduct>>[] = []
      for (let i = 0; i < 5; i++) {
        created.push(
          await createApprovedProduct({
            title: `Page Item ${i} ${suffix}`,
            category_id: category.data.category.id,
          })
        )
      }

      const seen = new Set<string>()
      let cursor: string | null = null
      let pages = 0
      do {
        const url: string = cursor
          ? `/products?category=${category.data.category.id}&limit=2&cursor=${cursor}`
          : `/products?category=${category.data.category.id}&limit=2`
        const page = await get(url)
        for (const item of page.data.products as { productCode: string }[]) {
          expect(seen.has(item.productCode)).toBe(false)
          seen.add(item.productCode)
        }
        cursor = page.data.next_cursor
        pages += 1
        expect(pages).toBeLessThan(10)
      } while (cursor)

      for (const product of created) {
        expect(seen.has(product.listing.product_code)).toBe(true)
      }
    })
  })

  describe("public brands", () => {
    test("only returns sellers with at least one approved listing", async () => {
      const neverApprovedSlug = `discovery-never-approved-${suffix}`
      await post("/seller-test-support/provision", {
        name: `Never Approved ${suffix}`,
        slug: neverApprovedSlug,
        email: `discovery-never-${suffix}@example.test`,
        password: "correct-horse-battery-n",
      })
      const neverLogin = await post("/auth/seller_user/emailpass", {
        email: `discovery-never-${suffix}@example.test`,
        password: "correct-horse-battery-n",
      })
      await post(
        "/seller/products",
        validProductPayload({}, baseCategoryId),
        neverLogin.data.token
      )

      await createApprovedProduct({ title: `BrandVisible ${suffix}` })

      const response = await get("/brands")
      const slugs = response.data.brands.map((b: { slug: string }) => b.slug)
      expect(slugs).toContain(sellerSlug)
      expect(slugs).not.toContain(neverApprovedSlug)
    })
  })
})
