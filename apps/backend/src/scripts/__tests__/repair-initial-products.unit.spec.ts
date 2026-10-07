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
  }>
) {
  const createProductsRun = jest.fn().mockResolvedValue({ result: [] })
  const updateProductsRun = jest.fn().mockResolvedValue({ result: [] })
  const createInventoryLevelsRun = jest.fn().mockResolvedValue({ result: [] })
  ;(createProductsWorkflow as unknown as jest.Mock).mockReturnValue({ run: createProductsRun })
  ;(updateProductsWorkflow as unknown as jest.Mock).mockReturnValue({ run: updateProductsRun })
  ;(createInventoryLevelsWorkflow as unknown as jest.Mock).mockReturnValue({
    run: createInventoryLevelsRun,
  })

  const productService = {
    listProductCategories: jest.fn().mockResolvedValue(categories),
    listProducts: jest.fn().mockResolvedValue(existingProducts),
  }
  const modules: Record<string, unknown> = {
    [ContainerRegistrationKeys.LOGGER]: { info: jest.fn() },
    [ContainerRegistrationKeys.QUERY]: {
      graph: jest
        .fn()
        .mockResolvedValueOnce({ data: [{ id: "ship-default" }] })
        .mockResolvedValueOnce({ data: [] }),
    },
    [Modules.PRODUCT]: productService,
    [Modules.SALES_CHANNEL]: {
      listSalesChannels: jest.fn().mockResolvedValue([{ id: "sc-default" }]),
    },
    [Modules.STOCK_LOCATION]: {
      listStockLocations: jest.fn().mockResolvedValue([{ id: "loc-eu" }]),
    },
  }
  const container = { resolve: (key: string) => modules[key] } as any

  return {
    container,
    productService,
    createProductsRun,
    updateProductsRun,
    createInventoryLevelsRun,
  }
}

describe("repairInitialProducts", () => {
  beforeEach(() => jest.clearAllMocks())

  it("creates every scaffold product when an older seed stopped before product creation", async () => {
    const { container, productService, createProductsRun, updateProductsRun } = setup([])

    await repairInitialProducts(container)

    expect(productService.listProductCategories).toHaveBeenCalledWith(
      { name: ["Shirts", "Sweatshirts", "Pants", "Bottoms", "Merch"] },
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
    const { container, productService, createProductsRun, updateProductsRun } = setup(existing)

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
  })

  it("does not rewrite category assignments after the legacy category is gone", async () => {
    const existing = [
      {
        id: "prod-shorts",
        handle: "shorts",
        categories: [{ id: "cat-bottoms" }, { id: "cat-seasonal" }],
      },
    ]
    const { container, updateProductsRun } = setup(existing)

    await repairInitialProducts(container)

    expect(updateProductsRun).not.toHaveBeenCalled()
  })
})
