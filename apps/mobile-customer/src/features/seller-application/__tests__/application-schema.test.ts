import { applicationSchema } from "../schemas/application-schema";

const validInput = {
  legal_business_name: "Acme Denim LLC",
  store_name: "Acme Denim",
  business_type: "llc",
  contact_first_name: "Jane",
  contact_last_name: "Doe",
  business_email: "jane@acmedenim.test",
  phone_number: "555-123-4567",
  website_url: "",
  address_line1: "123 Main St",
  address_line2: "",
  address_city: "Austin",
  address_state: "TX",
  address_postal_code: "78701",
  address_country: "us",
  currency_code: "usd",
  product_categories: ["Accessories"],
  business_description: "We make quality denim.",
  estimated_product_count: 50,
  agreed_to_terms: true,
};

describe("applicationSchema", () => {
  test("accepts valid input", () => {
    expect(applicationSchema.safeParse(validInput).success).toBe(true);
  });

  test("rejects a missing legal business name", () => {
    expect(applicationSchema.safeParse({ ...validInput, legal_business_name: "" }).success).toBe(false);
  });

  test("rejects an invalid business type", () => {
    expect(applicationSchema.safeParse({ ...validInput, business_type: "hobbyist" }).success).toBe(false);
  });

  test("accepts ETB as a currency choice", () => {
    expect(applicationSchema.safeParse({ ...validInput, currency_code: "etb" }).success).toBe(true);
  });

  test("rejects an unsupported currency", () => {
    expect(applicationSchema.safeParse({ ...validInput, currency_code: "eur" }).success).toBe(false);
  });

  test("rejects a malformed business email", () => {
    expect(applicationSchema.safeParse({ ...validInput, business_email: "not-an-email" }).success).toBe(false);
  });

  test("rejects an empty product category selection", () => {
    expect(applicationSchema.safeParse({ ...validInput, product_categories: [] }).success).toBe(false);
  });

  test("rejects when terms are not agreed to", () => {
    expect(applicationSchema.safeParse({ ...validInput, agreed_to_terms: false }).success).toBe(false);
  });

  test("accepts an Ethiopian address with no state or postal code", () => {
    const result = applicationSchema.safeParse({
      ...validInput,
      address_country: "et",
      address_state: "",
      address_postal_code: "",
      phone_number: "0911234567",
    });
    expect(result.success).toBe(true);
  });

  test("rejects a US address with no postal code", () => {
    const result = applicationSchema.safeParse({ ...validInput, address_postal_code: "" });
    expect(result.success).toBe(false);
  });

  test("rejects an invalid Ethiopian phone number", () => {
    const result = applicationSchema.safeParse({
      ...validInput,
      address_country: "et",
      address_postal_code: "",
      phone_number: "123",
    });
    expect(result.success).toBe(false);
  });
});
