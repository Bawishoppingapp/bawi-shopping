type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Mirrors packages/ui/src/StatusBadge.tsx's mapping for the same
// VendorOrder.status values - per docs/DESIGN-SYSTEM.md §6, a fixed
// status -> {tone, label} mapping lives once per feature area.
const TONES: Record<string, Tone> = {
  awaiting_preparation: "neutral",
  preparing: "warning",
  ready_for_pickup: "info",
  picked_up: "info",
  out_for_delivery: "warning",
  delivered: "success",
  cancelled: "danger",
  returned: "neutral",
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
};

export function fulfillmentStatusBadge(status: string): { label: string; tone: Tone } {
  return { label: LABELS[status] ?? status, tone: TONES[status] ?? "neutral" };
}
