import { Input } from "@bawi/mobile-ui";
import { Pressable, Text, View } from "react-native";

import type { ProductVariantInput } from "../services/seller-products-client";

interface VariantEditorProps {
  variants: ProductVariantInput[];
  onChange: (variants: ProductVariantInput[]) => void;
  /** Existing color/size values from an already-created product can't be
   * introduced fresh on edit - the backend 422s otherwise (see
   * seller-products-client.ts's doc comment). Editing is still allowed
   * for combos already present when the product was created. */
  lockedColorsAndSizes?: { colors: Set<string>; sizes: Set<string> } | null;
  currencySymbol?: string;
}

function emptyVariant(): ProductVariantInput {
  return { color: "", size: "", inventory_quantity: 0 };
}

export function VariantEditor({
  variants,
  onChange,
  lockedColorsAndSizes,
  currencySymbol = "$",
}: VariantEditorProps) {
  function updateVariant(index: number, patch: Partial<ProductVariantInput>) {
    onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function removeVariant(index: number) {
    onChange(variants.filter((_, i) => i !== index));
  }

  function addVariant() {
    onChange([...variants, emptyVariant()]);
  }

  return (
    <View className="gap-3">
      <Text className="text-body-sm font-medium text-ink-800">Color / size variants</Text>
      {lockedColorsAndSizes ? (
        <Text className="text-caption text-ink-500">
          You can adjust price and inventory, but a new color or size can&apos;t be added to an
          existing product - create a new product for that instead.
        </Text>
      ) : null}

      {variants.map((variant, index) => (
        <View key={index} className="gap-2 rounded-md border border-ink-100 p-3">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Input
                label="Color"
                value={variant.color}
                onChangeText={(text) => updateVariant(index, { color: text })}
                autoCapitalize="words"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Size"
                value={variant.size}
                onChangeText={(text) => updateVariant(index, { size: text })}
                autoCapitalize="characters"
              />
            </View>
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Input
                label={`Price override (optional, ${currencySymbol})`}
                value={variant.price !== undefined ? String(variant.price / 100) : ""}
                onChangeText={(text) => {
                  const dollars = Number(text);
                  updateVariant(index, {
                    price: text.trim() === "" || Number.isNaN(dollars) ? undefined : Math.round(dollars * 100),
                  });
                }}
                keyboardType="decimal-pad"
              />
            </View>
            <View className="flex-1">
              <Input
                label="Inventory"
                value={String(variant.inventory_quantity)}
                onChangeText={(text) => {
                  const qty = Number.parseInt(text, 10);
                  updateVariant(index, { inventory_quantity: Number.isNaN(qty) ? 0 : qty });
                }}
                keyboardType="number-pad"
              />
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => removeVariant(index)}>
            <Text className="text-caption text-danger">Remove variant</Text>
          </Pressable>
        </View>
      ))}

      <Pressable accessibilityRole="button" onPress={addVariant}>
        <Text className="text-body-sm font-medium text-ink-950">+ Add variant</Text>
      </Pressable>
    </View>
  );
}
