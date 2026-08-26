import { addressSchema } from "../schemas/address-schema";

const baseInput = {
  first_name: "Jane",
  last_name: "Doe",
  address_1: "123 Main St",
  city: "Austin",
  province: "TX",
  postal_code: "78701",
  country_code: "us",
  phone: "",
  is_default_shipping: false,
};

describe("addressSchema", () => {
  test("accepts a fully valid US address", () => {
    expect(addressSchema.safeParse(baseInput).success).toBe(true);
  });

  test("rejects a US address with no postal code", () => {
    const result = addressSchema.safeParse({ ...baseInput, postal_code: "" });
    expect(result.success).toBe(false);
  });

  test("accepts an Ethiopian address with no province or postal code", () => {
    const result = addressSchema.safeParse({
      ...baseInput,
      country_code: "et",
      province: "",
      postal_code: "",
    });
    expect(result.success).toBe(true);
  });

  test("accepts a valid Ethiopian phone number", () => {
    const result = addressSchema.safeParse({
      ...baseInput,
      country_code: "et",
      postal_code: "",
      phone: "0911234567",
    });
    expect(result.success).toBe(true);
  });

  test("rejects an invalid Ethiopian phone number", () => {
    const result = addressSchema.safeParse({
      ...baseInput,
      country_code: "et",
      postal_code: "",
      phone: "not-a-phone",
    });
    expect(result.success).toBe(false);
  });

  test("does not validate phone format for non-Ethiopian countries", () => {
    const result = addressSchema.safeParse({ ...baseInput, phone: "not-a-phone" });
    expect(result.success).toBe(true);
  });

  test("rejects a missing required field", () => {
    const { city, ...rest } = baseInput;
    expect(addressSchema.safeParse(rest).success).toBe(false);
  });
});
