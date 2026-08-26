"use client"

import { useActionState } from "react"
import { Button, Checkbox, FormField, Input, Select, Textarea } from "@bawi/ui"
import { submitApplication } from "../actions/submit-application"
import { initialApplicationState } from "../constants"
import { BUSINESS_TYPES, PRODUCT_CATEGORIES } from "../schemas/application-schema"

export function ApplicationForm() {
  const [state, formAction, pending] = useActionState(
    submitApplication,
    initialApplicationState
  )

  return (
    <form action={formAction} className="flex flex-col gap-8" noValidate>
      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-semibold text-neutral-900">Business</legend>
        <FormField label="Legal business name" error={state.fieldErrors.legal_business_name}>
          <Input name="legal_business_name" />
        </FormField>
        <FormField label="Public store name" error={state.fieldErrors.store_name}>
          <Input name="store_name" />
        </FormField>
        <FormField label="Business type" error={state.fieldErrors.business_type}>
          <Select name="business_type" defaultValue="">
            <option value="" disabled>
              Select a business type
            </option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Currency" error={state.fieldErrors.currency_code}>
          <Select name="currency_code" defaultValue="">
            <option value="" disabled>
              Select a currency
            </option>
            <option value="usd">USD ($)</option>
            <option value="etb">ETB (Br)</option>
          </Select>
        </FormField>
        <p className="-mt-2 text-xs text-neutral-500">
          Your whole catalog will be priced in this currency - it can&apos;t be changed per product later.
        </p>
        <FormField
          label="Business description"
          error={state.fieldErrors.business_description}
        >
          <Textarea name="business_description" />
        </FormField>
        <FormField
          label="Estimated number of products"
          error={state.fieldErrors.estimated_product_count}
        >
          <Input name="estimated_product_count" type="number" min={1} />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-900">
            Product categories
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PRODUCT_CATEGORIES.map((category) => (
              <label key={category} className="flex items-center gap-2 text-sm text-neutral-700">
                <Checkbox name="product_categories" value={category} />
                {category}
              </label>
            ))}
          </div>
          {state.fieldErrors.product_categories && (
            <p role="alert" className="text-sm text-red-600">
              {state.fieldErrors.product_categories}
            </p>
          )}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-semibold text-neutral-900">Contact</legend>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="First name" error={state.fieldErrors.contact_first_name}>
            <Input name="contact_first_name" autoComplete="given-name" />
          </FormField>
          <FormField label="Last name" error={state.fieldErrors.contact_last_name}>
            <Input name="contact_last_name" autoComplete="family-name" />
          </FormField>
        </div>
        <FormField label="Business email" error={state.fieldErrors.business_email}>
          <Input name="business_email" type="email" autoComplete="email" />
        </FormField>
        <FormField label="Phone number" error={state.fieldErrors.phone_number}>
          <Input name="phone_number" type="tel" autoComplete="tel" />
        </FormField>
        <FormField
          label="Website or social media URL (optional)"
          error={state.fieldErrors.website_url}
        >
          <Input name="website_url" type="url" placeholder="https://" />
        </FormField>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-lg font-semibold text-neutral-900">
          Business address (United States)
        </legend>
        <FormField label="Address line 1" error={state.fieldErrors.address_line1}>
          <Input name="address_line1" autoComplete="address-line1" />
        </FormField>
        <FormField label="Address line 2 (optional)" error={state.fieldErrors.address_line2}>
          <Input name="address_line2" autoComplete="address-line2" />
        </FormField>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="City" error={state.fieldErrors.address_city}>
            <Input name="address_city" autoComplete="address-level2" />
          </FormField>
          <FormField label="State" error={state.fieldErrors.address_state}>
            <Input name="address_state" autoComplete="address-level1" />
          </FormField>
          <FormField label="Postal code" error={state.fieldErrors.address_postal_code}>
            <Input name="address_postal_code" autoComplete="postal-code" />
          </FormField>
        </div>
      </fieldset>

      <label className="flex items-start gap-2 text-sm text-neutral-700">
        <Checkbox name="agreed_to_terms" className="mt-0.5" />
        I agree to the Bawi Shopping seller terms.
      </label>
      {state.fieldErrors.agreed_to_terms && (
        <p role="alert" className="-mt-6 text-sm text-red-600">
          {state.fieldErrors.agreed_to_terms}
        </p>
      )}

      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}

      <Button type="submit" loading={pending}>
        Submit application
      </Button>
    </form>
  )
}
