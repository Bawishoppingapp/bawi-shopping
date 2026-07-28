import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { Courier } from "./models/courier"
import { PickupCode } from "./models/pickup-code"
import { TrackingCode } from "./models/tracking-code"
import { FulfillmentCodeRedemption } from "./models/fulfillment-code-redemption"

class FulfillmentPrivacyModuleService extends MedusaService({
  Courier,
  PickupCode,
  TrackingCode,
  FulfillmentCodeRedemption,
}) {
  async isRedeemed(codeId: string): Promise<boolean> {
    const [existing] = await this.listFulfillmentCodeRedemptions({ code_id: codeId })
    return Boolean(existing)
  }

  /**
   * Atomically claims a code for redemption - a real unique-index INSERT,
   * not check-then-insert (see fulfillment-code-redemption.ts's model
   * comment). Returns `true` only for the call that actually claimed it;
   * the caller must apply the pickup/delivery side effect exclusively in
   * that case, and treat `false` as an invalid/replayed code, not an error.
   */
  async redeemCode(
    codeType: "pickup" | "tracking",
    codeId: string,
    courierId: string
  ): Promise<boolean> {
    try {
      await this.createFulfillmentCodeRedemptions({
        code_type: codeType,
        code_id: codeId,
        courier_id: courierId,
        redeemed_at: new Date(),
      })
      return true
    } catch {
      const alreadyRedeemed = await this.isRedeemed(codeId)
      if (alreadyRedeemed) {
        return false
      }
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Could not record redemption for ${codeType} code ${codeId}`
      )
    }
  }
}

export default FulfillmentPrivacyModuleService
