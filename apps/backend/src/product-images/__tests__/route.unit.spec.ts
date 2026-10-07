import { GET, POST } from "../../api/seller/products/[id]/image-workflow/route"
import { resolveVendorId } from "../../api/seller/utils"
import { imageAction } from "../service"
jest.mock("../../api/seller/utils", () => ({ resolveVendorId: jest.fn() }))
jest.mock("../service", () => ({ imageAction: jest.fn() }))

describe("seller image endpoint ownership", () => {
  it("does not disclose another seller's listing or invoke generation", async () => {
    ;(resolveVendorId as jest.Mock).mockResolvedValue("vendor-b")
    const listProductListings = jest.fn().mockResolvedValue([])
    const req = { params: { id: "vendor-a-listing" }, scope: { resolve: () => ({ listProductListings }) }, body: { action: "request" }, auth_context: { actor_id: "seller-b" } } as any
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any
    await GET(req, res)
    await POST(req, res)
    expect(listProductListings).toHaveBeenCalledWith({ id: "vendor-a-listing", vendor_id: "vendor-b" })
    expect(res.status).toHaveBeenCalledWith(404)
    expect(imageAction).not.toHaveBeenCalled()
  })
})
