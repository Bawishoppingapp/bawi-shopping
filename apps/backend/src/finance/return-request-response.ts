/**
 * Return-request shaping, same "whitelist fields per audience" discipline
 * as order-response.ts / seller-fulfillment-response.ts. `seller_response`
 * and `reviewed_by` are private to the seller/admin side - never returned
 * from a customer-facing endpoint (same tier as
 * seller_application.rejection_reason, see docs/SECURITY.md).
 */

export interface ReturnRequestLike {
  id: string
  vendor_order_item_id: string
  vendor_order_id: string
  vendor_id: string
  order_id: string
  customer_id: string
  reason: string
  customer_comment: string | null
  status: string
  seller_response: string | null
  reviewed_by: string | null
  reviewed_at: Date | string | null
  created_at: Date | string
}

export interface PublicReturnRequest {
  id: string
  vendor_order_item_id: string
  vendor_order_id: string
  order_id: string
  reason: string
  customer_comment: string | null
  status: string
  created_at: Date | string
}

export interface SellerReturnRequest extends PublicReturnRequest {
  seller_response: string | null
  reviewed_at: Date | string | null
}

export interface AdminReturnRequest extends SellerReturnRequest {
  vendor_id: string
  customer_id: string
  reviewed_by: string | null
}

export function shapeReturnRequestForCustomer(returnRequest: ReturnRequestLike): PublicReturnRequest {
  return {
    id: returnRequest.id,
    vendor_order_item_id: returnRequest.vendor_order_item_id,
    vendor_order_id: returnRequest.vendor_order_id,
    order_id: returnRequest.order_id,
    reason: returnRequest.reason,
    customer_comment: returnRequest.customer_comment,
    status: returnRequest.status,
    created_at: returnRequest.created_at,
  }
}

export function shapeReturnRequestForSeller(returnRequest: ReturnRequestLike): SellerReturnRequest {
  return {
    ...shapeReturnRequestForCustomer(returnRequest),
    seller_response: returnRequest.seller_response,
    reviewed_at: returnRequest.reviewed_at,
  }
}

export function shapeReturnRequestForAdmin(returnRequest: ReturnRequestLike): AdminReturnRequest {
  return {
    ...shapeReturnRequestForSeller(returnRequest),
    vendor_id: returnRequest.vendor_id,
    customer_id: returnRequest.customer_id,
    reviewed_by: returnRequest.reviewed_by,
  }
}
