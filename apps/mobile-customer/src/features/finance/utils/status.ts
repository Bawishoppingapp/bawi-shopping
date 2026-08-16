type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<string, Tone> = {
  pending: "warning",
  paid: "success",
  failed: "danger",
};

const LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
};

export function payoutStatusBadge(status: string): { label: string; tone: Tone } {
  return { label: LABELS[status] ?? status, tone: TONES[status] ?? "neutral" };
}
