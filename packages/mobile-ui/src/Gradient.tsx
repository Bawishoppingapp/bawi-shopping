import { LinearGradient as LinearGradientImpl } from "expo-linear-gradient";
import type { ComponentProps, JSX } from "react";

/**
 * expo-linear-gradient ships LinearGradient as a class component typed
 * against an older @types/react shape (its own .d.ts declares
 * `extends Component<Props>` without a `refs` member @types/react 19
 * requires structurally) - under @types/react@19.1.17 that fails with
 * "cannot be used as a JSX component ... Property 'refs' is missing",
 * even though it runs correctly at runtime (this is a type-check-only
 * mismatch, not a real incompatibility - Expo ships and tests this
 * package against React 19 fine). Re-typed once here rather than casting
 * at every call site or suppressing the error inline wherever it's used.
 *
 * Typed as a plain function returning JSX.Element, not React.FC - FC's
 * return type is the broader ReactNode (which in this @types/react
 * version includes bigint/Promise), and JSX's own element-type check
 * rejects that as "not assignable" even though it's internally
 * consistent - a separate, narrower quirk from the one above.
 */
type GradientProps = ComponentProps<typeof LinearGradientImpl>;
export const Gradient = LinearGradientImpl as unknown as (props: GradientProps) => JSX.Element;
