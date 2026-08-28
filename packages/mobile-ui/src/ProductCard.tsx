import { Image } from "expo-image";
import { Pressable, Text, View, type PressableProps } from "react-native";

import { ThemedIcon } from "./ThemedIcon";

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
  /** Overrides the default 4:5 image ratio - used by Home's masonry/
   * editorial sections for deliberately varied card heights. Discovery
   * grids should leave this unset (docs/DESIGN-SYSTEM.md §5's fixed
   * ratio still applies there, for a grid that never looks jagged). */
  imageAspectRatio?: number;
}

/**
 * Fixed 4:5 image ratio by default (docs/DESIGN-SYSTEM.md §5) so the
 * discovery grid never looks jagged regardless of which seller's photos
 * are shown - pass `imageAspectRatio` to opt out where varied heights are
 * the point. No badges/ribbons beyond a single "Sold out" state by
 * default - product photography carries the visual weight, not card
 * decoration (matches the design brief's "avoid clutter" direction).
 */
export function ProductCard({ product, className = "", imageAspectRatio = 4 / 5, ...props }: ProductCardProps) {
  const { title, brandName, imageUrl, priceLabel, compareAtPriceLabel, soldOut } = product;
  const onSale = Boolean(compareAtPriceLabel);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${brandName ? `, ${brandName}` : ""}, ${priceLabel}`}
      className={`w-full ${className}`}
      {...props}
    >
      <View
        style={{ aspectRatio: imageAspectRatio }}
        className="w-full overflow-hidden rounded-md border border-ink-100 bg-ink-100/60">
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
            <ThemedIcon name="image-outline" size={22} tone="ink400" />
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
