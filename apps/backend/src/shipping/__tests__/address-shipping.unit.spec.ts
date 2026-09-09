import { calculateAddressShipping } from "../address-shipping"

const address = {
  first_name: "Test", last_name: "Customer", address_1: "Bole Road",
  city: "Addis Ababa", country_code: "et", sub_city: "Bole", phone: "0911000000",
}

describe("address shipping", () => {
  test("uses the Addis Ababa flat fee", () => {
    expect(calculateAddressShipping(address, 15000, 25000)).toEqual({ amount: 15000, zone: "addis_ababa" })
  })

  test("uses the neighboring-zone fee", () => {
    expect(calculateAddressShipping({ ...address, city: "Bishoftu" }, 15000, 25000)).toEqual({ amount: 25000, zone: "neighboring" })
  })

  test("rejects unsupported destinations", () => {
    expect(calculateAddressShipping({ ...address, city: "Bahir Dar" }, 15000, 25000)).toBeNull()
  })
})
