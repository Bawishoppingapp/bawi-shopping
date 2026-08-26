"use client"

import { useActionState } from "react"
import { Button, Checkbox, FormField, Input } from "@bawi/ui"
import { createAddressAction, type AddressFormState } from "../actions/addresses-actions"

const initialState: AddressFormState = { status: "idle" }

export function AddressForm() {
  const [state, formAction, pending] = useActionState(createAddressAction, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="First name">
          <Input name="first_name" required />
        </FormField>
        <FormField label="Last name">
          <Input name="last_name" required />
        </FormField>
      </div>
      <FormField label="Address">
        <Input name="address_1" required />
      </FormField>
      <FormField label="Apartment, suite, etc. (optional)">
        <Input name="address_2" />
      </FormField>
      <div className="grid grid-cols-3 gap-4">
        <FormField label="City">
          <Input name="city" required />
        </FormField>
        <FormField label="State / Province">
          <Input name="province" />
        </FormField>
        <FormField label="ZIP / postal code (if applicable)">
          <Input name="postal_code" />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Country code (e.g. et, us)">
          <Input name="country_code" defaultValue="et" required />
        </FormField>
        <FormField label="Phone">
          <Input name="phone" type="tel" />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <Checkbox name="is_default_shipping" />
        Set as default shipping address
      </label>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
      <Button type="submit" loading={pending} className="self-start">
        Save address
      </Button>
    </form>
  )
}
