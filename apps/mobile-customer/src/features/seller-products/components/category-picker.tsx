import { Pressable, Text, View } from "react-native";

import type { CategoryOption } from "../services/seller-products-client";

interface CategoryPickerProps {
  categories: CategoryOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string;
}

export function CategoryPicker({ categories, selectedIds, onChange, error }: CategoryPickerProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-body-sm font-medium text-ink-800">Categories</Text>
      <Text className="text-caption text-ink-500">Select every category that fits this item.</Text>
      <View className="flex-row flex-wrap gap-2">
        {categories.map((category) => {
          const selected = selectedIds.includes(category.id);
          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(selected ? selectedIds.filter((id) => id !== category.id) : [...selectedIds, category.id])}
              className={`rounded-full border px-3 py-1.5 ${
                selected ? "border-ink-solid bg-ink-solid" : "border-ink-200"
              }`}
            >
              <Text className={`text-body-sm ${selected ? "text-white" : "text-ink-700"}`}>
                {category.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text className="text-body-sm text-danger">{error}</Text> : null}
    </View>
  );
}
