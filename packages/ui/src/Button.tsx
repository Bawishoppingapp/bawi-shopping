import type { ButtonHTMLAttributes } from "react"

type Variant = "primary" | "secondary" | "destructive"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

const base =
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium " +
  "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-offset-2 focus-visible:ring-neutral-900 " +
  "disabled:pointer-events-none disabled:opacity-50"

const variants: Record<Variant, string> = {
  primary: "bg-neutral-900 text-white hover:bg-neutral-800",
  secondary:
    "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50",
  destructive: "bg-red-600 text-white hover:bg-red-700",
}

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? "…" : children}
    </button>
  )
}
