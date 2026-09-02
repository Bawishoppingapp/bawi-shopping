import { Ionicons } from "@expo/vector-icons";
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
    <View className="mx-4 flex-row items-center gap-3 rounded-xl border border-gold-300 bg-gold-100 px-4 py-4">
      <View className="h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-solid">
        <Ionicons name="cube-outline" size={19} color="#FFFFFF" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-body-sm font-semibold text-ink-950">{title}</Text>
        <Text className="text-caption leading-4 text-ink-600">{body}</Text>
      </View>
    </View>
  );
}
