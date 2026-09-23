import { Button, ThemedIcon, useThemeColors } from "@bawi/mobile-ui";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTranslations } from "@/features/i18n/hooks/use-locale";

const SLIDE_COUNT = 3;

type OnboardingScreenProps = {
  onComplete: () => void;
};

function LogoVisual({ motion }: { motion: Animated.Value }) {
  const scale = motion.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.025] });
  const glow = motion.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] });

  return (
    <View style={styles.visualCanvas}>
      <Animated.View style={[styles.logoHalo, { opacity: glow, transform: [{ scale }] }]} />
      <Animated.View style={[styles.heroLogoWrap, { transform: [{ scale }] }]}>
        <Image
          source={require("@/assets/brand/logo-source.png")}
          style={styles.heroLogo}
          contentFit="cover"
          accessibilityLabel="Bawi Shopping"
        />
      </Animated.View>
    </View>
  );
}

function DiscoveryVisual({ motion }: { motion: Animated.Value }) {
  const colors = useThemeColors();
  const pulse = motion.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] });
  const drift = motion.interpolate({ inputRange: [0, 1], outputRange: [-8, 9] });

  return (
    <View style={styles.visualCanvas}>
      <Animated.View style={[styles.orbit, { borderColor: colors.gold600, transform: [{ scale: pulse }] }]} />
      <Animated.View style={[styles.discoveryBubble, styles.bubbleOne, { transform: [{ translateX: drift }] }]}>
        <ThemedIcon name="shirt-outline" size={28} />
      </Animated.View>
      <Animated.View style={[styles.discoveryBubble, styles.bubbleTwo, { transform: [{ translateY: drift }] }]}>
        <ThemedIcon name="footsteps-outline" size={28} />
      </Animated.View>
      <Animated.View style={[styles.discoveryBubble, styles.bubbleThree, { transform: [{ translateX: drift }] }]}>
        <ThemedIcon name="diamond-outline" size={27} />
      </Animated.View>
      <View style={[styles.searchHero, { backgroundColor: colors.surface }] }>
        <View style={[styles.searchIcon, { backgroundColor: colors.ink950 }] }>
          <ThemedIcon name="search" size={38} tone="gold600" />
        </View>
        <View style={styles.searchCopy}>
          <View style={[styles.searchLine, { backgroundColor: colors.ink800 }]} />
          <View style={[styles.searchLineSmall, { backgroundColor: colors.ink400 }]} />
        </View>
      </View>
    </View>
  );
}

function DeliveryVisual({ motion }: { motion: Animated.Value }) {
  const colors = useThemeColors();
  const travel = motion.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });
  const pulse = motion.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.05] });

  return (
    <View style={styles.visualCanvas}>
      <View style={[styles.deliveryRoute, { backgroundColor: colors.ink400 }]} />
      <View style={[styles.routeDot, styles.routeDotLeft, { backgroundColor: colors.gold600 }]} />
      <View style={[styles.routeDot, styles.routeDotRight, { backgroundColor: colors.gold600 }]} />
      <Animated.View
        style={[styles.deliveryTruck, { backgroundColor: colors.ink950, transform: [{ translateX: travel }] }]}
      >
        <ThemedIcon name="car-outline" size={42} tone="gold600" />
      </Animated.View>
      <Animated.View
        style={[styles.deliveryBadge, { backgroundColor: colors.surface, transform: [{ scale: pulse }] }]}
      >
        <View style={styles.deliveryCheck}>
          <ThemedIcon name="checkmark" size={27} tone="gold600" />
        </View>
        <View style={styles.deliveryCopy}>
          <View style={[styles.lineLong, { backgroundColor: colors.ink800 }]} />
          <View style={[styles.lineShort, { backgroundColor: colors.ink400 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { width } = useWindowDimensions();
  const t = useTranslations();
  const colors = useThemeColors();
  const scrollX = useRef(new Animated.Value(0)).current;
  const motion = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const slides = [
    { eyebrow: t("onboarding.one.eyebrow"), title: t("onboarding.one.title"), body: t("onboarding.one.body") },
    { eyebrow: t("onboarding.two.eyebrow"), title: t("onboarding.two.title"), body: t("onboarding.two.body") },
    { eyebrow: t("onboarding.three.eyebrow"), title: t("onboarding.three.title"), body: t("onboarding.three.body") },
  ];

  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) return;
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(motion, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(motion, { toValue: 0, duration: 1800, useNativeDriver: true }),
        ]),
      );
      animation.start();
    });
    return () => animation?.stop();
  }, [motion]);

  const goNext = () => {
    if (page === SLIDE_COUNT - 1) {
      onComplete();
      return;
    }
    Haptics.selectionAsync();
    scrollRef.current?.scrollTo({ x: width * (page + 1), animated: true });
  };

  const updatePage = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("onboarding.skip")}
            onPress={onComplete}
            hitSlop={12}
            style={styles.skipButton}
          >
            <Text className="text-body-sm font-medium text-ink-700">{t("onboarding.skip")}</Text>
          </Pressable>
        </View>

        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={updatePage}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          style={styles.pager}
        >
          {slides.map((slide, index) => {
            const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
            const contentOpacity = scrollX.interpolate({ inputRange, outputRange: [0.2, 1, 0.2], extrapolate: "clamp" });
            const contentTranslate = scrollX.interpolate({ inputRange, outputRange: [36, 0, -36], extrapolate: "clamp" });

            return (
              <View key={slide.title} style={[styles.slide, { width }] }>
                <Animated.View style={[styles.visualWrap, { opacity: contentOpacity, transform: [{ translateX: contentTranslate }] }] }>
                  {index === 0 ? <LogoVisual motion={motion} /> : null}
                  {index === 1 ? <DiscoveryVisual motion={motion} /> : null}
                  {index === 2 ? <DeliveryVisual motion={motion} /> : null}
                </Animated.View>
                <Animated.View style={[styles.copyWrap, { opacity: contentOpacity, transform: [{ translateX: contentTranslate }] }] }>
                  <Text className="text-caption font-semibold uppercase tracking-widest text-gold-600">{slide.eyebrow}</Text>
                  <Text className="font-serif text-display text-ink-950" style={styles.title}>{slide.title}</Text>
                  <Text className="text-body text-ink-500" style={styles.body}>{slide.body}</Text>
                </Animated.View>
              </View>
            );
          })}
        </Animated.ScrollView>

        <View style={styles.footer}>
          <View accessibilityLabel={`${page + 1} / ${SLIDE_COUNT}`} style={styles.dots}>
            {slides.map((_, index) => {
              const dotWidth = scrollX.interpolate({
                inputRange: [(index - 1) * width, index * width, (index + 1) * width],
                outputRange: [8, 28, 8],
                extrapolate: "clamp",
              });
              const opacity = scrollX.interpolate({
                inputRange: [(index - 1) * width, index * width, (index + 1) * width],
                outputRange: [0.25, 1, 0.25],
                extrapolate: "clamp",
              });
              return <Animated.View key={index} style={[styles.dot, { backgroundColor: colors.gold600, width: dotWidth, opacity }]} />;
            })}
          </View>
          <Button size="lg" onPress={goNext} className="w-full">
            {page === SLIDE_COUNT - 1 ? t("onboarding.start") : t("onboarding.next")}
          </Button>
          <Text className="text-center text-caption text-ink-400">{t("onboarding.swipeHint")}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  header: { minHeight: 64, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skipButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  pager: { flex: 1 },
  slide: { flex: 1, paddingHorizontal: 24 },
  visualWrap: { flex: 1, minHeight: 290, justifyContent: "center" },
  visualCanvas: { height: 292, width: "100%", alignSelf: "center", justifyContent: "center", alignItems: "center" },
  copyWrap: { minHeight: 190, gap: 10, justifyContent: "flex-end", paddingBottom: 14 },
  title: { fontSize: 36, lineHeight: 41, letterSpacing: -0.8, maxWidth: 350 },
  body: { fontSize: 16, lineHeight: 24, maxWidth: 355 },
  footer: { paddingHorizontal: 24, paddingBottom: 10, gap: 12 },
  dots: { height: 18, flexDirection: "row", alignItems: "center", gap: 7 },
  dot: { height: 8, borderRadius: 4 },
  logoHalo: { position: "absolute", width: 286, height: 286, borderRadius: 143, backgroundColor: "#C79A54" },
  heroLogoWrap: { width: 292, height: 292, borderRadius: 146, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  heroLogo: { width: 310, height: 310 },
  productLines: { gap: 7, paddingHorizontal: 4, paddingVertical: 12 },
  lineLong: { height: 7, width: 76, borderRadius: 4 },
  lineShort: { height: 6, width: 45, borderRadius: 3 },
  orbit: { position: "absolute", width: 230, height: 230, borderRadius: 115, borderWidth: 1, opacity: 0.3 },
  discoveryBubble: { position: "absolute", width: 58, height: 58, borderRadius: 29, backgroundColor: "rgba(199,154,84,0.20)", alignItems: "center", justifyContent: "center" },
  bubbleOne: { left: 18, top: 52 },
  bubbleTwo: { right: 12, top: 64 },
  bubbleThree: { right: 40, bottom: 24 },
  searchHero: { width: 226, minHeight: 94, borderRadius: 28, flexDirection: "row", alignItems: "center", padding: 17, gap: 15, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  searchIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  searchCopy: { flex: 1, gap: 9 },
  searchLine: { height: 9, width: "100%", borderRadius: 5 },
  searchLineSmall: { height: 7, width: "65%", borderRadius: 4 },
  deliveryRoute: { position: "absolute", height: 2, width: 265, opacity: 0.35 },
  routeDot: { position: "absolute", width: 12, height: 12, borderRadius: 6 },
  routeDotLeft: { left: 29 },
  routeDotRight: { right: 29 },
  deliveryTruck: { width: 96, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: -72, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  deliveryBadge: { position: "absolute", bottom: 23, width: 236, minHeight: 78, borderRadius: 22, flexDirection: "row", alignItems: "center", padding: 15, gap: 14, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 4 },
  deliveryCheck: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(199,154,84,0.18)", alignItems: "center", justifyContent: "center" },
  deliveryCopy: { gap: 8 },
});
