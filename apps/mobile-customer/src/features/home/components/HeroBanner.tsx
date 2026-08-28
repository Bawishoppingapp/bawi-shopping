import { Gradient } from "@bawi/mobile-ui";
import { router } from "expo-router";
import { Pressable, Text } from "react-native";

interface HeroBannerProps {
  eyebrow: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaHref: Parameters<typeof router.push>[0];
}

/**
 * Full-width editorial cover for the top of Home - a solid dark
 * gradient rather than a photo, since no seller has uploaded real
 * product photography yet (every thumbnail in the catalog is still
 * null). Once photography exists this is the natural place to swap in a
 * campaign image behind the same gradient-and-text treatment; the
 * layout doesn't need to change for that.
 */
export function HeroBanner({ eyebrow, headline, body, ctaLabel, ctaHref }: HeroBannerProps) {
  return (
    <Gradient
      colors={["#2A2320", "#151210"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: 20 }}
      className="mx-4 gap-4 overflow-hidden px-6 py-8"
    >
      <Text className="text-overline text-gold-500">{eyebrow}</Text>
      <Text className="font-serif text-hero text-white">{headline}</Text>
      {/* text-white/70, not a theme-reactive ink token: this gradient is
          fixed-dark regardless of app theme, so a token that inverts in
          dark mode (ink-200 -> near-black) would go invisible here. */}
      <Text className="text-body text-white/70">{body}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(ctaHref)}
        className="mt-2 flex-row items-center self-start rounded-full bg-white px-5 py-3 active:opacity-80"
      >
        {/* text-ink-solid (fixed dark), not text-ink-950: the button fill
            is always white, so a theme-reactive text color would go
            invisible in dark mode the same way ink-solid exists for the
            reverse case (fixed-dark fills) - see Button.tsx's primary
            variant. */}
        <Text className="text-body-sm font-medium text-ink-solid">{ctaLabel}</Text>
      </Pressable>
    </Gradient>
  );
}
