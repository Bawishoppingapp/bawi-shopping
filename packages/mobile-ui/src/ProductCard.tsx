import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View, type PressableProps } from "react-native";

export interface ProductCardData {
  id: string;
  title: string;
  brandName?: string;
  imageUrl?: string;
  priceLabel: string;
  compareAtPriceLabel?: string;
  soldOut?: boolean;
}

interface ProductCardProps extends Omit<PressableProps, "children"> {
  product: ProductCardData;
}

/**
 * Fixed 4:5 image ratio (docs/DESIGN-SYSTEM.md §5) so the discovery grid
 * never looks jagged regardless of which seller's photos are shown. No
 * badges/ribbons beyond a single "Sold out" state by default - product
 * photography carries the visual weight, not card decoration (matches
 * the design brief's "avoid clutter" direction).
 */
export function ProductCard({ product, className = "", ...props }: ProductCardProps) {
  const { title, brandName, imageUrl, priceLabel, compareAtPriceLabel, soldOut } = product;
  const onSale = Boolean(compareAtPriceLabel);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${brandName ? `, ${brandName}` : ""}, ${priceLabel}`}
      className={`w-full ${className}`}
      {...props}
    >
      <View className="aspect-[4/5] w-full overflow-hidden rounded-md border border-ink-100 bg-ink-100/60">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
            cachePolicy="disk"
          />
        ) : (
          <View className="h-full w-full items-center justify-center gap-1.5">
            <Ionicons name="image-outline" size={22} color="#B8AD9F" />
            <Text className="text-caption text-ink-400">No image yet</Text>
          </View>
        )}
        {soldOut ? (
          <View className="absolute inset-0 items-center justify-center bg-white/70">
            <Text className="text-body-sm font-medium uppercase tracking-wide text-ink-700">Sold out</Text>
          </View>
        ) : null}
      </View>
      <View className="mt-2 gap-0.5">
        {brandName ? (
          <Text numberOfLines={1} className="text-caption uppercase tracking-wide text-ink-500">
            {brandName}
          </Text>
        ) : null}
        <Text numberOfLines={2} className="text-body-sm text-ink-950">
          {title}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Text className={`text-body-sm font-medium ${onSale ? "text-danger" : "text-ink-950"}`}>
            {priceLabel}
          </Text>
          {compareAtPriceLabel ? (
            <Text className="text-caption text-ink-400 line-through">{compareAtPriceLabel}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
