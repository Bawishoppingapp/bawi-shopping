import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  seeAllHref?: Parameters<typeof router.push>[0];
}

/** Shared "Title (+ optional subtitle) / See all" header used across
 * every Home section that needs one - kept out of each section so the
 * heading treatment stays identical everywhere it appears. */
export function SectionHeader({ title, subtitle, seeAllHref }: SectionHeaderProps) {
  const t = useTranslations();
  return (
    <View className="flex-row items-end justify-between px-4">
      <View className="min-w-0 flex-1 gap-0.5 pr-3">
        <Text className="font-serif text-h1 text-ink-950">{title}</Text>
        {subtitle ? <Text className="text-body-sm text-ink-500">{subtitle}</Text> : null}
      </View>
      {seeAllHref ? (
        <Pressable className="shrink-0" accessibilityRole="button" onPress={() => router.push(seeAllHref)} hitSlop={8}>
          <Text className="text-body-sm font-medium text-gold-600">{t("home.viewAll")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
