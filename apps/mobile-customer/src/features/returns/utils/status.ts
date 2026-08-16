type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<string, Tone> = {
  requested: "info",
  approved: "success",
  denied: "danger",
  refunded: "success",
};

const LABELS: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  denied: "Denied",
  refunded: "Refunded",
};

export function returnStatusBadge(status: string): { label: string; tone: Tone } {
  return { label: LABELS[status] ?? status, tone: TONES[status] ?? "neutral" };
}

const REASON_LABELS: Record<string, string> = {
  damaged: "Damaged",
  defective: "Defective",
  incorrect: "Incorrect item",
  customer_remorse: "Changed their mind",
};

export function returnReasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}
