import { Gradient } from "@bawi/mobile-ui";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Text, View } from "react-native";

interface PromoBannerProps {
  title: string;
  body: string;
}

/**
 * Shorter, quieter second banner - a gold-tinted strip rather than the
 * hero's full dark treatment, so the two full-width moments on the page
 * don't compete. The icon badge is the one deliberately "glassy" element
 * on Home (per the design brief's "glassy elements only where tasteful")
 * - a single restrained use, not a whole-app blur treatment.
 */
export function PromoBanner({ title, body }: PromoBannerProps) {
  return (
    <Gradient
      colors={["#F5E9D3", "#EAD9B3"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ borderRadius: 18 }}
      className="mx-4 flex-row items-center gap-4 overflow-hidden px-5 py-4"
    >
      <BlurView
        intensity={40}
        tint="light"
        style={{ borderRadius: 999, overflow: "hidden" }}
        className="h-11 w-11 items-center justify-center"
      >
        <Ionicons name="sparkles-outline" size={20} color="#151210" />
      </BlurView>
      {/* text-ink-solid, not text-ink-950/700: this gradient is a fixed
          light gold regardless of app theme, so theme-reactive ink tokens
          (which flip pale in dark mode) would lose all contrast here. */}
      <View className="flex-1 gap-0.5">
        <Text className="text-body-sm font-semibold text-ink-solid">{title}</Text>
        <Text className="text-caption text-ink-solid/70">{body}</Text>
      </View>
    </Gradient>
  );
}
