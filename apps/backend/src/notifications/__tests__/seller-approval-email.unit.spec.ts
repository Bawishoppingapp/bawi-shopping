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
    expect(template.emailBody).toContain("secret123")
    expect(template.html).toContain(`href="${activationLink}"`)
    expect(template.html).toContain("Activation code for the Bawi app")
    expect(template.html).toContain("enter the code to open your storefront")
    expect(template.html).toContain("7 days")
  })

  it("gives each resend a distinct subject and warns that older links stop working", () => {
    const template = sellerApplicationApprovedTemplate({
      storeName: "Bawi Fashion",
      activationLink: "https://sell.example.com/activate?token=new123",
      resend: true,
      sentAt: new Date("2026-10-27T05:27:12Z"),
    })
    expect(template.subject).toContain("2026-10-27T05:27:12.000Z")
    expect(template.emailBody).toContain("new123")
    expect(template.html).toContain("replaces previous activation codes")
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
