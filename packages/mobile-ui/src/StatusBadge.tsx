import { Text, View } from "react-native";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  label: string;
  tone: Tone;
}

const bgClasses: Record<Tone, string> = {
  success: "bg-success/10",
  warning: "bg-warning/10",
  danger: "bg-danger/10",
  info: "bg-info/10",
  neutral: "bg-ink-100",
};

const textClasses: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
  neutral: "text-ink-700",
};

/**
 * One shared status pill, matching docs/DESIGN-SYSTEM.md §6's rule: a
 * fixed status -> {tone, label} mapping is defined once per feature area
 * (e.g. a `fulfillmentStatusTone(status)` helper colocated with the
 * fulfillment feature), never re-implemented per screen. This component
 * only renders the result - it doesn't know about any specific status
 * enum.
 */
export function StatusBadge({ label, tone }: StatusBadgeProps) {
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${bgClasses[tone]}`}>
      <Text className={`text-caption font-medium uppercase ${textClasses[tone]}`}>{label}</Text>
    </View>
  );
}
