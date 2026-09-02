import {
  createEthiopianPaymentGateway,
  registerEthiopianPaymentProvider,
  type EthiopianPaymentGateway,
} from "../ethiopian-payment-gateway"

describe("Ethiopian payment gateway registry", () => {
  test("fails closed when payments are disabled", () => {
    expect(() => createEthiopianPaymentGateway("disabled")).toThrow(/disabled/i)
  })

  test("rejects a configured provider that has no installed adapter", () => {
    expect(() => createEthiopianPaymentGateway("future-bank")).toThrow(/no installed adapter/i)
  })

  test("returns a registered provider without making a payment", () => {
    const gateway = { providerId: "test-bank" } as EthiopianPaymentGateway
    registerEthiopianPaymentProvider("test-bank", () => gateway)
    expect(createEthiopianPaymentGateway("TEST-BANK")).toBe(gateway)
  })

  test("does not allow disabled to be registered as a real provider", () => {
    expect(() =>
      registerEthiopianPaymentProvider("disabled", () => ({}) as EthiopianPaymentGateway)
    ).toThrow(/real payment provider id/i)
  })
})

