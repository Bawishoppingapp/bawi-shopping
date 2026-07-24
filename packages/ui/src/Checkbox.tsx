import { forwardRef, type InputHTMLAttributes } from "react"

type CheckboxProps = InputHTMLAttributes<HTMLInputElement>

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={
          "h-4 w-4 rounded border-neutral-300 text-neutral-900 " +
          "focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 " +
          className
        }
        {...props}
      />
    )
  }
)

Checkbox.displayName = "Checkbox"
