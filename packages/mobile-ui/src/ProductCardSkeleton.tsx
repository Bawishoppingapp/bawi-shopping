import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

/**
 * Same footprint as ProductCard (aspect-[4/5] image + two text lines +
 * price line) so a grid of skeletons never reflows into real cards once
 * data arrives. A single shared opacity pulse, not per-card animated
 * values, keeps a full grid of these cheap to mount.
 */
export function ProductCardSkeleton({ className = "" }: { className?: string }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <View className={`w-full ${className}`}>
      <Animated.View className="aspect-[4/5] w-full rounded-md bg-ink-100" style={{ opacity }} />
      <View className="mt-2 gap-1.5">
        <Animated.View className="h-2.5 w-2/5 rounded-full bg-ink-100" style={{ opacity }} />
        <Animated.View className="h-3 w-4/5 rounded-full bg-ink-100" style={{ opacity }} />
        <Animated.View className="h-3 w-1/3 rounded-full bg-ink-100" style={{ opacity }} />
      </View>
    </View>
  );
}
