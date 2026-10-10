import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

interface HeroBannerProps {
  imageUri?: string | null;
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: Parameters<typeof router.push>[0];
}

/** An image-first campaign story with a quiet caption beneath it. */
export function HeroBanner({ imageUri, eyebrow, headline, body, ctaLabel, ctaHref }: HeroBannerProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${ctaLabel}`}
      onPress={() => router.push(ctaHref)}
      className="mx-4 overflow-hidden bg-surface active:opacity-90"
    >
      <View className="aspect-[4/5] w-full overflow-hidden bg-ink-100">
        <Image
          source={imageUri ? { uri: imageUri } : require("../../../../assets/images/bawi-editorial-campaign.jpg")}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      </View>
      <View className="items-center px-5 py-5" style={{ gap: 7 }}>
        <Text className="text-overline uppercase tracking-[2px] text-ink-500">{eyebrow}</Text>
        <Text className="text-center font-serif text-h1 text-ink-950">{headline}</Text>
        <Text className="text-center text-body-sm leading-5 text-ink-500">{body}</Text>
        <View className="mt-1 border-b border-ink-950 pb-0.5">
          <Text className="text-body-sm font-semibold uppercase tracking-wide text-ink-950">{ctaLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}
