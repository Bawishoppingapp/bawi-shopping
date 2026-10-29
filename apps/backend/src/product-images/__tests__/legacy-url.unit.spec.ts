import { resolveProductImageUrl } from "../legacy-url"

describe("legacy product image URLs", () => {
  const original = process.env.S3_FILE_URL

  afterEach(() => {
    if (original === undefined) delete process.env.S3_FILE_URL
    else process.env.S3_FILE_URL = original
  })

  it("points old localhost images at the configured public bucket", () => {
    process.env.S3_FILE_URL = "https://media.example.com/"
    expect(resolveProductImageUrl("http://localhost:9000/static/photo.png"))
      .toBe("https://media.example.com/photo.png")
  })

  it("leaves current URLs and local development unchanged", () => {
    process.env.S3_FILE_URL = "https://media.example.com"
    expect(resolveProductImageUrl("https://other.example.com/photo.png"))
      .toBe("https://other.example.com/photo.png")
    delete process.env.S3_FILE_URL
    expect(resolveProductImageUrl("http://localhost:9000/static/photo.png"))
      .toBe("http://localhost:9000/static/photo.png")
    expect(resolveProductImageUrl(null)).toBeNull()
  })
})
