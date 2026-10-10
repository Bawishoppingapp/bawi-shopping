import { ThemedIcon } from "@bawi/mobile-ui";
import type { ComponentProps } from "react";
import { Text, View } from "react-native";

type IconName = ComponentProps<typeof ThemedIcon>["name"];

export function EditorialEmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon: IconName;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <View className="flex-1 justify-center px-7 py-16">
      <View className="mb-8 h-16 w-16 items-center justify-center rounded-full border border-ink-200 bg-surface">
        <ThemedIcon name={icon} size={27} tone="ink700" />
      </View>
      <View className="mb-5 h-px w-12 bg-ink-950" />
      <Text className="font-serif text-display text-ink-950">{title}</Text>
      <Text className="mt-3 max-w-80 text-body leading-6 text-ink-500">{description}</Text>
      {actions ? <View className="mt-8 gap-3">{actions}</View> : null}
    </View>
  );
}
