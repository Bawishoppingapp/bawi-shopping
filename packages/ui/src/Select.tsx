import { forwardRef, type SelectHTMLAttributes } from "react"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ invalid = false, className = "", children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={
          "w-full rounded-md border bg-white px-3 py-2 text-sm text-neutral-900 " +
          "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 " +
          (invalid
            ? "border-red-400 focus:ring-red-500 "
            : "border-neutral-300 ") +
          className
        }
        {...props}
      >
        {children}
      </select>
    )
  }
)

Select.displayName = "Select"
