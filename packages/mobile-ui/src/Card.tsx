import { View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  padded?: boolean;
}

/**
 * A restrained surface - flat white on paper, a hairline border rather
 * than a shadow (avoids the "generic SaaS dashboard" look flagged in the
 * design brief). Used for grouped content (a fulfillment order, a
 * payout row) - not a default wrapper for everything.
 */
export function Card({ padded = true, className = "", children, ...props }: CardProps) {
  return (
    <View
      className={`rounded-lg border border-ink-200 bg-surface ${padded ? "p-4" : ""} ${className}`}
      {...props}
    >
      {children}
    </View>
  );
}
