import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { CategoryForm } from "../components/category-form"

vi.mock("../actions/create", () => ({
  createCategoryAction: vi.fn(),
}))
vi.mock("../actions/update", () => ({
  updateCategoryAction: vi.fn(),
}))

const parentOptions = [
  { id: "cat_1", name: "Shirts", depth: 0 },
  { id: "cat_2", name: "T-Shirts", depth: 1 },
]

describe("CategoryForm", () => {
  test("create mode renders an empty name field, parent select, and all five translation fields", () => {
    render(<CategoryForm mode="create" parentOptions={parentOptions} />)

    expect(screen.getByLabelText("Name")).toHaveValue("")
    expect(screen.getByLabelText("Parent category")).toBeInTheDocument()
    expect(screen.getByText("No parent (top-level)")).toBeInTheDocument()
    expect(screen.getByText("Shirts")).toBeInTheDocument()
    expect(screen.getByText("T-Shirts")).toBeInTheDocument()

    expect(screen.getByLabelText("አማርኛ (Amharic)")).toBeInTheDocument()
    expect(screen.getByLabelText("ትግርኛ (Tigrinya)")).toBeInTheDocument()
    expect(screen.getByLabelText("Afaan Oromoo (Oromo)")).toBeInTheDocument()
    expect(screen.getByLabelText("简体中文 (Chinese)")).toBeInTheDocument()
    expect(screen.getByLabelText("Español (Spanish)")).toBeInTheDocument()

    expect(screen.getByRole("button", { name: "Create category" })).toBeInTheDocument()
  })

  test("edit mode pre-fills the form from initialValues", () => {
    render(
      <CategoryForm
        mode="edit"
        categoryId="cat_3"
        parentOptions={parentOptions}
        initialValues={{
          name: "Dresses",
          parent_category_id: "cat_1",
          is_active: false,
          translations: { es: "Vestidos" },
        }}
      />
    )

    expect(screen.getByLabelText("Name")).toHaveValue("Dresses")
    expect(screen.getByLabelText("Parent category")).toHaveValue("cat_1")
    expect(screen.getByLabelText("Español (Spanish)")).toHaveValue("Vestidos")
    expect(screen.getByLabelText("Active (visible to customers and sellers)")).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument()
  })

  test("the active checkbox defaults to checked when creating", () => {
    render(<CategoryForm mode="create" parentOptions={parentOptions} />)
    expect(screen.getByLabelText("Active (visible to customers and sellers)")).toBeChecked()
  })
})
