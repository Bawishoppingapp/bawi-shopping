import { forwardRef, type TextareaHTMLAttributes } from "react"

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ invalid = false, className = "", rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
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

Textarea.displayName = "Textarea"
