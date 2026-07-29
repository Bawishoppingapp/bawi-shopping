import { isValidTransition } from "../state-machine"

describe("product translation state machine", () => {
  describe("valid transitions", () => {
    test.each([
      ["draft", "pending_review"],
      ["pending_review", "approved"],
      ["pending_review", "rejected"],
      ["rejected", "draft"],
    ] as const)("%s -> %s is valid", (from, to) => {
      expect(isValidTransition(from, to)).toBe(true)
    })
  })

  describe("invalid transitions", () => {
    test.each([
      ["draft", "approved"],
      ["draft", "rejected"],
      ["approved", "rejected"],
      ["approved", "pending_review"],
      ["approved", "draft"],
      ["rejected", "approved"],
      ["rejected", "pending_review"],
      ["pending_review", "draft"],
    ] as const)("%s -> %s is invalid", (from, to) => {
      expect(isValidTransition(from, to)).toBe(false)
    })
  })

  test("approved is a dead end - no transitions out (edit creates a fresh draft cycle via upsertDraft, not a status transition)", () => {
    expect(isValidTransition("approved", "draft")).toBe(false)
    expect(isValidTransition("approved", "pending_review")).toBe(false)
    expect(isValidTransition("approved", "rejected")).toBe(false)
  })
})
