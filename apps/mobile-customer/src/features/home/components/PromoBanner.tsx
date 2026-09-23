import { Text, View } from "react-native";

interface PromoBannerProps {
  title: string;
  body: string;
}

/**
 * A restrained shipping card using the same radius and border language
 * as the rest of Home. Keeping it flat avoids the oversized pill/glass
 * shape that competed with the product sections around it.
 */
export function PromoBanner({ title, body }: PromoBannerProps) {
  return (
    <View className="mx-4 rounded-xl border border-gold-300 bg-gold-100 px-4 py-4">
      <View className="gap-0.5">
        <Text className="text-body-sm font-semibold text-ink-950">{title}</Text>
        <Text className="text-caption leading-4 text-ink-600">{body}</Text>
      </View>
    </View>
  );
}
