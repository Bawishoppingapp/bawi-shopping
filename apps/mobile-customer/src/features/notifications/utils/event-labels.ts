type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Mirrors the 8 NotificationEventType values from
// apps/backend/src/notifications/record-notification.ts - the closed set
// every workflow in this project writes through recordNotification().
const LABELS: Record<string, string> = {
  order_confirmation: "Order confirmed",
  shipment_update: "Shipment update",
  delivery_confirmation: "Delivered",
  return_status_changed: "Return update",
  refund_processed: "Refund processed",
  payout_sent: "Payout sent",
  seller_application_approved: "Application approved",
  seller_application_rejected: "Application update",
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

export function notificationEventBadge(eventType: string): { label: string; tone: Tone } {
  return { label: LABELS[eventType] ?? eventType, tone: TONES[eventType] ?? "neutral" };
}
