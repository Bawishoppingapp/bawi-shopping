type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Mirrors packages/ui/src/StatusBadge.tsx's STYLES/LABELS maps for the
// same status values (VendorOrder.status, MarketplaceOrder.status) -
// same fixed status -> {tone, label} mapping, just expressed as
// mobile-ui's {label, tone} StatusBadge API instead of a Tailwind class
// string. Per docs/DESIGN-SYSTEM.md §6, this mapping lives once per
// feature area.
const TONES: Record<string, Tone> = {
  awaiting_preparation: "neutral",
  preparing: "warning",
  ready_for_pickup: "info",
  picked_up: "info",
  out_for_delivery: "warning",
  delivered: "success",
  cancelled: "danger",
  returned: "neutral",
  pending_payment: "neutral",
  paid: "success",
  payment_failed: "danger",
};

const LABELS: Record<string, string> = {
  awaiting_preparation: "Awaiting preparation",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  pending_payment: "Pending payment",
  paid: "Paid",
  payment_failed: "Payment failed",
};

export function orderStatusBadge(status: string): { label: string; tone: Tone } {
  return { label: LABELS[status] ?? status, tone: TONES[status] ?? "neutral" };
}
