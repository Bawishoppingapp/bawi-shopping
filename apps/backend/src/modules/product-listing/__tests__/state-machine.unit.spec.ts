import { isTerminal, isValidTransition } from "../state-machine"

describe("product listing state machine", () => {
  describe("valid transitions", () => {
    test.each([
      ["draft", "pending_review"],
      ["pending_review", "approved"],
      ["pending_review", "rejected"],
      ["approved", "archived"],
      ["rejected", "draft"],
    ] as const)("%s -> %s is valid", (from, to) => {
      expect(isValidTransition(from, to)).toBe(true)
    })
  })

  describe("invalid transitions", () => {
    test.each([
      ["draft", "approved"],
      ["draft", "rejected"],
      ["draft", "archived"],
      ["approved", "rejected"],
      ["approved", "pending_review"],
      ["approved", "draft"],
      ["rejected", "approved"],
      ["rejected", "pending_review"],
      ["archived", "draft"],
      ["archived", "approved"],
      ["pending_review", "draft"],
      ["pending_review", "archived"],
    ] as const)("%s -> %s is invalid", (from, to) => {
      expect(isValidTransition(from, to)).toBe(false)
    })
  })

  test("archived is the only terminal status", () => {
    expect(isTerminal("archived")).toBe(true)
    expect(isTerminal("draft")).toBe(false)
    expect(isTerminal("pending_review")).toBe(false)
    expect(isTerminal("approved")).toBe(false)
    expect(isTerminal("rejected")).toBe(false)
  })
})
