import { isTerminal, isValidTransition } from "../state-machine"

describe("seller application state machine", () => {
  describe("valid transitions", () => {
    test.each([
      ["draft", "submitted"],
      ["submitted", "under_review"],
      ["submitted", "approved"],
      ["submitted", "rejected"],
      ["submitted", "withdrawn"],
      ["under_review", "approved"],
      ["under_review", "rejected"],
      ["under_review", "withdrawn"],
    ] as const)("%s -> %s is valid", (from, to) => {
      expect(isValidTransition(from, to)).toBe(true)
    })
  })

  describe("invalid transitions", () => {
    test.each([
      ["draft", "approved"],
      ["draft", "rejected"],
      ["approved", "rejected"],
      ["approved", "submitted"],
      ["rejected", "approved"],
      ["rejected", "submitted"],
      ["withdrawn", "approved"],
      ["withdrawn", "submitted"],
      ["submitted", "draft"],
    ] as const)("%s -> %s is invalid", (from, to) => {
      expect(isValidTransition(from, to)).toBe(false)
    })
  })

  describe("isTerminal", () => {
    test.each(["approved", "rejected", "withdrawn"] as const)(
      "%s is terminal",
      (status) => {
        expect(isTerminal(status)).toBe(true)
      }
    )

    test.each(["draft", "submitted", "under_review"] as const)(
      "%s is not terminal",
      (status) => {
        expect(isTerminal(status)).toBe(false)
      }
    )
  })
})
