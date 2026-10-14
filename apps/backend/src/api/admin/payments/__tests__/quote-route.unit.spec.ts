import { POST } from "../[id]/quote/route"
import { MARKETPLACE_ORDER_MODULE } from "../../../../modules/marketplace-order"
import { AUDIT_LOG_MODULE } from "../../../../modules/audit-log"

describe("admin delivery quote", () => {
  const order = {
    id: "order_1", display_id: "BAWI-1", customer_id: "cus_1", currency_code: "etb",
    status: "pending_quote", payment_status: "pending", subtotal_amount: 10000,
    tax_amount: 0, shipping_amount: 0,
  }

  function setup(body: unknown, currentOrder = order) {
    const updateMarketplaceOrders = jest.fn().mockResolvedValue({})
    const retrieveMarketplaceOrder = jest.fn().mockResolvedValue(currentOrder)
    const record = jest.fn().mockResolvedValue(undefined)
    const req = {
      params: { id: "order_1" }, body, auth_context: { actor_id: "admin_1" },
      scope: { resolve: (key: string) => {
        if (key === MARKETPLACE_ORDER_MODULE) return { retrieveMarketplaceOrder, updateMarketplaceOrders }
        if (key === AUDIT_LOG_MODULE) return { record }
        return { retrieveCustomer: jest.fn().mockResolvedValue({ email: null }) }
      } },
    } as never
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() }
    return { req, res, updateMarketplaceOrders, record }
  }

  it("sets a final ETB total before payment is allowed", async () => {
    const { req, res, updateMarketplaceOrders, record } = setup({ shipping_amount: 25000 })
    await POST(req, res as never)
    expect(updateMarketplaceOrders).toHaveBeenCalledWith({
      id: "order_1", status: "pending_payment", shipping_amount: 25000, total_amount: 35000,
    })
    expect(record).toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ order_id: "order_1", status: "pending_payment", shipping: 25000, total: 35000 })
  })

  it("rejects a duplicate quote after payment becomes available", async () => {
    const { req, res, updateMarketplaceOrders } = setup({ shipping_amount: 30000 }, { ...order, status: "pending_payment" })
    await POST(req, res as never)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(updateMarketplaceOrders).not.toHaveBeenCalled()
  })

  it("rejects a non-integer delivery fee", async () => {
    const { req, res, updateMarketplaceOrders } = setup({ shipping_amount: 100.5 })
    await POST(req, res as never)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(updateMarketplaceOrders).not.toHaveBeenCalled()
  })
})
