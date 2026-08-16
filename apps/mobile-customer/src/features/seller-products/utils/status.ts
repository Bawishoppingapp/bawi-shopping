type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Mirrors packages/ui/src/StatusBadge.tsx's mapping for the same
// ProductListingStatus values (apps/backend/src/modules/product-listing/
// state-machine.ts) - per docs/DESIGN-SYSTEM.md §6, a fixed status ->
// {tone, label} mapping lives once per feature area.
const TONES: Record<string, Tone> = {
  draft: "neutral",
  pending_review: "warning",
  approved: "success",
  rejected: "danger",
  archived: "neutral",
};

const LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
  archived: "Archived",
};

export function productStatusBadge(status: string): { label: string; tone: Tone } {
  return { label: LABELS[status] ?? status, tone: TONES[status] ?? "neutral" };
}

export function isProductEditable(status: string): boolean {
  return status === "draft" || status === "rejected";
}
