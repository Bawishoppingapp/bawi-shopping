import { router } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";
import type { CategoryNode } from "@/features/discovery/services/discovery-client";
import { useTranslations } from "@/features/i18n/hooks/use-locale";

export function CategoryStrip({ categories }: { categories: CategoryNode[] }) {
  const t = useTranslations();
  return (
    <View style={{ gap: 12 }}>
      <Text className="px-4 text-body font-semibold text-ink-950">{t("home.shopByCategory")}</Text>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={categories}
        keyExtractor={(category) => category.id}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button"
            onPress={() => router.push({ pathname: "/(tabs)/search", params: { category: item.id, categoryName: item.name } })}
            className="min-h-11 justify-center rounded-full border border-ink-200 bg-surface px-4 py-3 active:bg-ink-100">
            <Text className="text-body-sm font-medium text-ink-950">{item.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}
