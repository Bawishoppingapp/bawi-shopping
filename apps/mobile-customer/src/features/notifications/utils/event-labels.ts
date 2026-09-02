type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Mirrors the 8 NotificationEventType values from
// apps/backend/src/notifications/record-notification.ts - the closed set
// every workflow in this project writes through recordNotification().
const LABEL_KEYS = {
  order_confirmation: "notification.orderConfirmed",
  shipment_update: "notification.shipmentUpdate",
  delivery_confirmation: "notification.delivered",
  return_status_changed: "notification.returnUpdate",
  refund_processed: "notification.refundProcessed",
  payout_sent: "notification.payoutSent",
  seller_application_approved: "notification.applicationApproved",
  seller_application_rejected: "notification.applicationUpdate",
} as const;
const ENGLISH_LABELS: Record<string, string> = {
  order_confirmation: "Order confirmed", shipment_update: "Shipment update", delivery_confirmation: "Delivered",
  return_status_changed: "Return update", refund_processed: "Refund processed", payout_sent: "Payout sent",
  seller_application_approved: "Application approved", seller_application_rejected: "Application update",
};

const TONES: Record<string, Tone> = {
  order_confirmation: "info",
  shipment_update: "info",
  delivery_confirmation: "success",
  return_status_changed: "warning",
  refund_processed: "success",
  payout_sent: "success",
  seller_application_approved: "success",
  seller_application_rejected: "danger",
};

export function notificationEventBadge(
  eventType: string,
  t?: (key: (typeof LABEL_KEYS)[keyof typeof LABEL_KEYS]) => string,
): { label: string; tone: Tone } {
  const key = LABEL_KEYS[eventType as keyof typeof LABEL_KEYS];
  return { label: key && t ? t(key) : ENGLISH_LABELS[eventType] ?? eventType, tone: TONES[eventType] ?? "neutral" };
}
