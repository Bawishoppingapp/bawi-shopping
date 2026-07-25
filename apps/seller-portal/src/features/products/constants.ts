export interface ProductFormState {
  status: "idle" | "error"
  fieldErrors: Record<string, string>
  formError?: string
}

export const initialProductFormState: ProductFormState = {
  status: "idle",
  fieldErrors: {},
}

export interface VariantRow {
  color: string
  size: string
  price: string
  inventory_quantity: string
}

export const EMPTY_VARIANT_ROW: VariantRow = {
  color: "",
  size: "",
  price: "",
  inventory_quantity: "0",
}

export interface ImageUploadState {
  status: "idle" | "success" | "error"
  message?: string
}

export const initialImageUploadState: ImageUploadState = {
  status: "idle",
}
