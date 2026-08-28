import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { FlatList, Pressable, Text, View } from "react-native";

import type { CategoryNode } from "@/features/discovery/services/discovery-client";

interface CategoryStripProps {
  categories: CategoryNode[];
}

// Cycled by index, not per-category (no per-category color exists or is
// planned) - just enough variety that the row doesn't read as one
// repeated tile. bg-surface's card is outlined instead of tinted so it
// still reads clearly against paper in both themes.
const TILE_STYLES = ["bg-gold-100", "bg-ink-100", "bg-surface border border-ink-200"];

/**
 * Category "story" cards instead of small pill chips - no category has
 * an image in the backend (CategoryNode carries no thumbnail field, and
 * adding one is a backend change out of scope here), so these lean on
 * bold serif typography and tinted color blocks rather than faking
 * photography that doesn't exist.
 */
export function CategoryStrip({ categories }: CategoryStripProps) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={categories}
      keyExtractor={(c) => c.id}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}
      renderItem={({ item, index }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: "/(tabs)/search", params: { category: item.id, categoryName: item.name } })
          }
          className={`h-28 w-36 justify-between rounded-2xl p-4 active:opacity-80 ${TILE_STYLES[index % TILE_STYLES.length]}`}
        >
          <Text numberOfLines={2} className="font-serif text-h3 text-ink-950">
            {item.name}
          </Text>
          {/* Literal white, not ThemedIcon: this chip is always dark
              (bg-ink-solid, fixed), so the icon must stay fixed-white
              too - a theme-reactive tone would go invisible in light
              mode (ink950 resolves dark there, on an already-dark chip). */}
          <View className="h-7 w-7 items-center justify-center rounded-full bg-ink-solid">
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </View>
        </Pressable>
      )}
    />
  );
}
