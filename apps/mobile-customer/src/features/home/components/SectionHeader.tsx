import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  seeAllHref?: Parameters<typeof router.push>[0];
}

/** Shared "Title (+ optional subtitle) / See all" header used across
 * every Home section that needs one - kept out of each section so the
 * heading treatment stays identical everywhere it appears. */
export function SectionHeader({ title, subtitle, seeAllHref }: SectionHeaderProps) {
  return (
    <View className="flex-row items-end justify-between px-4">
      <View className="gap-0.5">
        <Text className="font-serif text-h1 text-ink-950">{title}</Text>
        {subtitle ? <Text className="text-body-sm text-ink-500">{subtitle}</Text> : null}
      </View>
      {seeAllHref ? (
        <Pressable accessibilityRole="button" onPress={() => router.push(seeAllHref)} hitSlop={8}>
          <Text className="text-body-sm font-medium text-gold-600">See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
