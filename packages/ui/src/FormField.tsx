import { cloneElement, useId, type ReactElement } from "react"

interface FormFieldProps {
  label: string
  error?: string
  children: ReactElement<{
    id?: string
    "aria-invalid"?: boolean
    "aria-describedby"?: string
  }>
}

/**
 * Wires an accessible label + error message around a single form control:
 * label `htmlFor`/input `id` association, `aria-invalid`, and
 * `aria-describedby` pointing at the error text so screen readers announce
 * it. See docs/DESIGN-SYSTEM.md #8 (accessibility) and #7 (error states).
 */
export function FormField({ label, error, children }: FormFieldProps) {
  const inputId = useId()
  const errorId = `${inputId}-error`

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-900">
        {label}
      </label>
      {cloneElement(children, {
        id: inputId,
        "aria-invalid": Boolean(error),
        "aria-describedby": error ? errorId : undefined,
      })}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
