import { forwardRef, type InputHTMLAttributes } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ invalid = false, className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={
          "w-full rounded-md border px-3 py-2 text-sm text-neutral-900 " +
          "placeholder:text-neutral-400 focus:outline-none focus:ring-2 " +
          "focus:ring-neutral-900 focus:ring-offset-1 " +
          (invalid
            ? "border-red-400 focus:ring-red-500 "
            : "border-neutral-300 ") +
          className
        }
        {...props}
      />
    )
  }
)

Input.displayName = "Input"
