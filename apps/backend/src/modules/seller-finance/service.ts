import { MedusaService } from "@medusajs/framework/utils"
import { CommissionLedgerEntry } from "./models/commission-ledger-entry"
import { Payout } from "./models/payout"
import { PayoutLineItem } from "./models/payout-line-item"
import { ReturnRequest } from "./models/return-request"
import { OrderRefund } from "./models/refund"
import { Dispute } from "./models/dispute"

class SellerFinanceModuleService extends MedusaService({
  CommissionLedgerEntry,
  Payout,
  PayoutLineItem,
  ReturnRequest,
  OrderRefund,
  Dispute,
}) {}

export default SellerFinanceModuleService
