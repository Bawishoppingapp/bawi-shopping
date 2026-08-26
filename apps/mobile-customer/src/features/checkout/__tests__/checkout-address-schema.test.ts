import { checkoutAddressSchema } from "../schemas/checkout-address-schema";

const baseInput = {
  first_name: "Jane",
  last_name: "Doe",
  address_1: "123 Main St",
  city: "Austin",
  province: "TX",
  postal_code: "78701",
  country_code: "us",
  phone: "555-123-4567",
};

describe("checkoutAddressSchema", () => {
  test("accepts a fully valid US address", () => {
    expect(checkoutAddressSchema.safeParse(baseInput).success).toBe(true);
  });

  test("rejects a US address with no postal code", () => {
    const result = checkoutAddressSchema.safeParse({ ...baseInput, postal_code: "" });
    expect(result.success).toBe(false);
  });

  test("accepts an Ethiopian address with no province or postal code", () => {
    const result = checkoutAddressSchema.safeParse({
      ...baseInput,
      country_code: "et",
      province: "",
      postal_code: "",
      phone: "0911234567",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an invalid Ethiopian phone number", () => {
    const result = checkoutAddressSchema.safeParse({
      ...baseInput,
      country_code: "et",
      postal_code: "",
      phone: "12345",
    });
    expect(result.success).toBe(false);
  });

  test("does not apply Ethiopian phone validation to other countries", () => {
    // "12345" would fail Ethiopian format validation, but should pass for
    // a US address since only country_code === "et" triggers that check.
    const result = checkoutAddressSchema.safeParse({ ...baseInput, phone: "12345" });
    expect(result.success).toBe(true);
  });

  test("rejects a missing required field", () => {
    const { address_1, ...rest } = baseInput;
    const result = checkoutAddressSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  test("rejects a country code shorter than 2 characters", () => {
    const result = checkoutAddressSchema.safeParse({ ...baseInput, country_code: "u" });
    expect(result.success).toBe(false);
  });
});
