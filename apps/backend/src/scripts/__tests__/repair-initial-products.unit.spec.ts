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
]

function setup(existingProducts: Array<{ id: string; handle: string }>) {
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

  return { container, createProductsRun, updateProductsRun, createInventoryLevelsRun }
}

describe("repairInitialProducts", () => {
  beforeEach(() => jest.clearAllMocks())

  it("creates every scaffold product when an older seed stopped before product creation", async () => {
    const { container, createProductsRun, updateProductsRun } = setup([])

    await repairInitialProducts(container)

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

  it("reconciles existing products without creating duplicates", async () => {
    const existing = [
      { id: "prod-shirt", handle: "t-shirt" },
      { id: "prod-sweatshirt", handle: "sweatshirt" },
      { id: "prod-sweatpants", handle: "sweatpants" },
      { id: "prod-shorts", handle: "shorts" },
    ]
    const { container, createProductsRun, updateProductsRun } = setup(existing)

    await repairInitialProducts(container)

    expect(createProductsRun).not.toHaveBeenCalled()
    expect(updateProductsRun).toHaveBeenCalledWith({
      input: {
        products: expect.arrayContaining([
          { id: "prod-shorts", categories: [{ id: "cat-bottoms" }] },
        ]),
      },
    })
  })
})
