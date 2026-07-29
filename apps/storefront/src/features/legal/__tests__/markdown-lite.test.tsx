import { describe, expect, test } from "vitest"
import { render, screen } from "@testing-library/react"
import { renderMarkdownLite } from "../markdown-lite"

describe("renderMarkdownLite", () => {
  test("renders headers at three levels", () => {
    render(<>{renderMarkdownLite("# Title\n\n## Section\n\n### Subsection")}</>)
    expect(screen.getByRole("heading", { level: 1, name: "Title" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: "Section" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3, name: "Subsection" })).toBeInTheDocument()
  })

  test("renders bold text and links inline", () => {
    render(<>{renderMarkdownLite("This is **bold** and a [link](https://example.test).")}</>)
    expect(screen.getByText("bold")).toBeInTheDocument()
    const link = screen.getByRole("link", { name: "link" })
    expect(link).toHaveAttribute("href", "https://example.test")
  })

  test("renders a blockquote as a callout", () => {
    render(<>{renderMarkdownLite("> This is a draft notice.")}</>)
    expect(screen.getByText("This is a draft notice.")).toBeInTheDocument()
  })

  test("renders a table with header and body rows", () => {
    render(<>{renderMarkdownLite("| A | B |\n| --- | --- |\n| 1 | 2 |")}</>)
    expect(screen.getByRole("columnheader", { name: "A" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "B" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "1" })).toBeInTheDocument()
    expect(screen.getByRole("cell", { name: "2" })).toBeInTheDocument()
  })

  test("renders a bulleted list", () => {
    render(<>{renderMarkdownLite("- First item\n- Second item")}</>)
    expect(screen.getByText("First item")).toBeInTheDocument()
    expect(screen.getByText("Second item")).toBeInTheDocument()
  })

  test("renders plain paragraphs", () => {
    render(<>{renderMarkdownLite("Plain paragraph text.")}</>)
    expect(screen.getByText("Plain paragraph text.")).toBeInTheDocument()
  })
})
