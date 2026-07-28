import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { CartMergeClaim } from "./models/cart-merge-claim"

class CartMergeModuleService extends MedusaService({
  CartMergeClaim,
}) {
  async hasClaimed(guestCartId: string): Promise<boolean> {
    const [existing] = await this.listCartMergeClaims({ guest_cart_id: guestCartId })
    return Boolean(existing)
  }

  /**
   * Atomically claims a guest cart id via the table's unique index - a real
   * INSERT, not a check-then-insert race. Returns `true` if this call is
   * the one that claimed it (the caller should proceed with the merge);
   * returns `false` if another concurrent (or duplicate/retried) call
   * already claimed it a moment earlier - the caller must skip the merge
   * entirely, which is what makes guest-to-customer cart merge safe under
   * true concurrent execution, not just sequential replay. Same pattern as
   * WebhookEventModuleService.markProcessed - see docs/DECISIONS.md.
   */
  async claim(guestCartId: string, customerId: string): Promise<boolean> {
    try {
      await this.createCartMergeClaims({
        guest_cart_id: guestCartId,
        customer_id: customerId,
        claimed_at: new Date(),
      })
      return true
    } catch {
      const alreadyClaimed = await this.hasClaimed(guestCartId)
      if (alreadyClaimed) {
        return false
      }
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Could not record cart merge claim for guest cart ${guestCartId}`
      )
    }
  }
}

export default CartMergeModuleService
