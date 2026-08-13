import { Pressable, Text, View } from "react-native";

import type { CategoryOption } from "../services/products-client";

interface CategoryPickerProps {
  categories: CategoryOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  error?: string;
}

export function CategoryPicker({ categories, selectedId, onSelect, error }: CategoryPickerProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-body-sm font-medium text-ink-800">Category</Text>
      <View className="flex-row flex-wrap gap-2">
        {categories.map((category) => (
          <Pressable
            key={category.id}
            accessibilityRole="button"
            onPress={() => onSelect(category.id)}
            className={`rounded-full border px-3 py-1.5 ${
              selectedId === category.id ? "border-ink-950 bg-ink-950" : "border-ink-200"
            }`}
          >
            <Text className={`text-body-sm ${selectedId === category.id ? "text-white" : "text-ink-700"}`}>
              {category.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text className="text-body-sm text-danger">{error}</Text> : null}
    </View>
  );
}
