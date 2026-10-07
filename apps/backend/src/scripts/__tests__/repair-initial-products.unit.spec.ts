import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { repairInitialProducts } from "../repair-initial-products"

jest.mock("@medusajs/medusa/core-flows", () => ({
  createInventoryLevelsWorkflow: jest.fn(),
  createProductsWorkflow: jest.fn(),
  updateProductsWorkflow: jest.fn(),
}))

const categories = [
  { id: "cat-shirts", name: "Shirts" },
  { id: "cat-sweatshirts", name: "Sweatshirts" },
  { id: "cat-pants", name: "Pants" },
  { id: "cat-bottoms", name: "Bottoms" },
  { id: "cat-merch", name: "Merch" },
]

function setup(
  existingProducts: Array<{
    id: string
    handle: string
    categories?: Array<{ id: string }>
  }>,
  availableCategories = categories
) {
  const createProductsRun = jest.fn().mockImplementation(({ input }) =>
    Promise.resolve({
      result: input.products.map((product: { handle: string }) => ({
        id: `created-${product.handle}`,
        handle: product.handle,
      })),
    })
  )
  const updateProductsRun = jest.fn().mockResolvedValue({ result: [] })
  const createInventoryLevelsRun = jest.fn().mockResolvedValue({ result: [] })
  ;(createProductsWorkflow as unknown as jest.Mock).mockReturnValue({ run: createProductsRun })
  ;(updateProductsWorkflow as unknown as jest.Mock).mockReturnValue({ run: updateProductsRun })
  ;(createInventoryLevelsWorkflow as unknown as jest.Mock).mockReturnValue({
    run: createInventoryLevelsRun,
  })

  const productService = {
    listProductCategories: jest.fn().mockResolvedValue(availableCategories),
    listProducts: jest.fn().mockResolvedValue(existingProducts),
  }
  const queryGraph = jest.fn().mockImplementation(({ entity }) => {
    if (entity === "shipping_profile") {
      return Promise.resolve({ data: [{ id: "ship-default" }] })
    }
    if (entity === "product_variant") {
      return Promise.resolve({
        data: [
          {
            id: "variant-created",
            inventory_items: [
              { inventory: { id: "inv-created", location_levels: [] } },
            ],
          },
        ],
      })
    }
    throw new Error(`Unexpected graph entity: ${entity}`)
  })
  const listSalesChannels = jest.fn().mockResolvedValue([{ id: "sc-default" }])
  const listStockLocations = jest.fn().mockResolvedValue([{ id: "loc-eu" }])
  const modules: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: { info: jest.fn() },
    [ContainerRegistrationKeys.QUERY]: { graph: queryGraph },
    [Modules.PRODUCT]: productService,
    [Modules.SALES_CHANNEL]: {
      listSalesChannels,
    },
    [Modules.STOCK_LOCATION]: {
      listStockLocations,
    },
  }
  const container = { resolve: (key: string) => modules[key] } as any

  return {
    container,
    productService,
    createProductsRun,
    updateProductsRun,
    createInventoryLevelsRun,
    queryGraph,
    listSalesChannels,
    listStockLocations,
  }
}

const existingScaffoldProducts = [
  {
    id: "prod-shirt",
    handle: "t-shirt",
    categories: [{ id: "cat-shirts" }],
  },
  {
    id: "prod-sweatshirt",
    handle: "sweatshirt",
    categories: [{ id: "cat-sweatshirts" }],
  },
  {
    id: "prod-sweatpants",
    handle: "sweatpants",
    categories: [{ id: "cat-pants" }],
  },
  {
    id: "prod-shorts",
    handle: "shorts",
    categories: [{ id: "cat-bottoms" }],
  },
]

describe("repairInitialProducts", () => {
  beforeEach(() => jest.clearAllMocks())

  it("creates every scaffold product when an older seed stopped before product creation", async () => {
    const {
      container,
      productService,
      createProductsRun,
      updateProductsRun,
      createInventoryLevelsRun,
      queryGraph,
    } = setup([])

    await repairInitialProducts(container)

    expect(productService.listProductCategories).toHaveBeenCalledWith(
      { name: ["Shirts", "Sweatshirts", "Pants", "Bottoms"] },
      { select: ["id", "name"] }
    )
    expect(updateProductsRun).not.toHaveBeenCalled()
    expect(createProductsRun).toHaveBeenCalledWith({
      input: {
        products: expect.arrayContaining([
          expect.objectContaining({ handle: "t-shirt" }),
          expect.objectContaining({ handle: "sweatshirt" }),
          expect.objectContaining({ handle: "sweatpants" }),
          expect.objectContaining({
            handle: "shorts",
            categories: [{ id: "cat-bottoms" }],
          }),
        ]),
      },
    })
    expect(queryGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "product_variant",
        filters: {
          product_id: [
            "created-t-shirt",
            "created-sweatshirt",
            "created-sweatpants",
            "created-shorts",
          ],
        },
      })
    )
    expect(createInventoryLevelsRun).toHaveBeenCalledWith({
      input: {
        inventory_levels: [
          {
            location_id: "loc-eu",
            stocked_quantity: 1_000_000,
            inventory_item_id: "inv-created",
          },
        ],
      },
    })
  })

  it("replaces only the legacy Shorts category and preserves other assignments", async () => {
    const existing = [
      {
        id: "prod-shirt",
        handle: "t-shirt",
        categories: [{ id: "cat-shirts" }, { id: "cat-promo" }],
      },
      {
        id: "prod-sweatshirt",
        handle: "sweatshirt",
        categories: [{ id: "cat-sweatshirts" }],
      },
      {
        id: "prod-sweatpants",
        handle: "sweatpants",
        categories: [{ id: "cat-pants" }],
      },
      {
        id: "prod-shorts",
        handle: "shorts",
        categories: [{ id: "cat-merch" }, { id: "cat-seasonal" }],
      },
    ]
    const {
      container,
      productService,
      createProductsRun,
      updateProductsRun,
      createInventoryLevelsRun,
      queryGraph,
    } = setup(existing)

    await repairInitialProducts(container)

    expect(createProductsRun).not.toHaveBeenCalled()
    expect(productService.listProducts).toHaveBeenNthCalledWith(
      1,
      { handle: ["t-shirt", "sweatshirt", "sweatpants", "shorts"] },
      { select: ["id", "handle"], relations: ["categories"] }
    )
    expect(updateProductsRun).toHaveBeenCalledWith({
      input: {
        products: [
          {
            id: "prod-shorts",
            categories: [{ id: "cat-seasonal" }, { id: "cat-bottoms" }],
          },
        ],
      },
    })
    expect(queryGraph).not.toHaveBeenCalled()
    expect(createInventoryLevelsRun).not.toHaveBeenCalled()
  })

  it("does not rewrite category assignments after the legacy category is gone", async () => {
    const existing = existingScaffoldProducts.map((product) =>
      product.handle === "shorts"
        ? {
            ...product,
            categories: [{ id: "cat-bottoms" }, { id: "cat-seasonal" }],
          }
        : product
    )
    const { container, createProductsRun, updateProductsRun, queryGraph } = setup(existing)

    await repairInitialProducts(container)

    expect(createProductsRun).not.toHaveBeenCalled()
    expect(updateProductsRun).not.toHaveBeenCalled()
    expect(queryGraph).not.toHaveBeenCalled()
  })

  it("does not require original category names when no product needs repair", async () => {
    const renamedCategories = existingScaffoldProducts.map((product) => ({
      ...product,
      categories: [{ id: `renamed-${product.handle}` }],
    }))
    const {
      container,
      productService,
      createProductsRun,
      updateProductsRun,
      listSalesChannels,
      listStockLocations,
    } = setup(renamedCategories, [])

    await repairInitialProducts(container)

    expect(productService.listProductCategories).toHaveBeenCalledWith(
      { name: ["Merch", "Bottoms"] },
      { select: ["id", "name"] }
    )
    expect(createProductsRun).not.toHaveBeenCalled()
    expect(updateProductsRun).not.toHaveBeenCalled()
    expect(listSalesChannels).not.toHaveBeenCalled()
    expect(listStockLocations).not.toHaveBeenCalled()
  })

  it("creates inventory only for a product created by this invocation", async () => {
    const existingWithoutShorts = existingScaffoldProducts.filter(
      (product) => product.handle !== "shorts"
    )
    const {
      container,
      createInventoryLevelsRun,
      queryGraph,
    } = setup(
      existingWithoutShorts,
      categories.filter((category) => category.name === "Bottoms")
    )

    await repairInitialProducts(container)

    expect(queryGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "product_variant",
        filters: { product_id: ["created-shorts"] },
      })
    )
    expect(createInventoryLevelsRun).toHaveBeenCalledTimes(1)
  })
})
