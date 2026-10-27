import { sellerApplicationApprovedTemplate } from "../templates"

describe("seller approval email", () => {
  it("includes a clickable activation link while keeping the inbox summary token-free", () => {
    const activationLink = "https://sell.example.com/activate?token=secret123"
    const template = sellerApplicationApprovedTemplate({
      storeName: "Bawi Fashion",
      activationLink,
    })
    expect(template.body).not.toContain("secret123")
    expect(template.emailBody).toContain(activationLink)
    expect(template.html).toContain(`href="${activationLink}"`)
    expect(template.html).toContain("7 days")
  })

  it("escapes a seller-provided store name in HTML", () => {
    const template = sellerApplicationApprovedTemplate({
      storeName: "<script>alert(1)</script>",
      activationLink: "https://sell.example.com/activate?token=abc",
    })
    expect(template.html).not.toContain("<script>")
    expect(template.html).toContain("&lt;script&gt;")
  })
})
