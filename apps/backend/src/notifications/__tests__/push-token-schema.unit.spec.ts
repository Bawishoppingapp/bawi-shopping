import {
  expoPushTokenSchema,
  registerPushTokenSchema,
  unregisterPushTokenSchema,
} from "../push-token-schema"

describe("Expo push token schemas", () => {
  it.each([
    "ExpoPushToken[abcDEF123_-]",
    "ExponentPushToken[legacy-token]",
  ])("accepts a supported token: %s", (token) => {
    expect(expoPushTokenSchema.parse(token)).toBe(token)
  })

  it.each([
    "",
    "not-a-token",
    "ExpoPushToken[]",
    "ExpoPushToken[token]\nextra",
    `ExpoPushToken[${"a".repeat(300)}]`,
  ])("rejects an invalid token: %s", (token) => {
    expect(expoPushTokenSchema.safeParse(token).success).toBe(false)
  })

  it("trims a valid token and accepts a known platform", () => {
    expect(registerPushTokenSchema.parse({
      expo_push_token: "  ExpoPushToken[abc123]  ",
      platform: "ios",
    })).toEqual({ expo_push_token: "ExpoPushToken[abc123]", platform: "ios" })
  })

  it("rejects unsupported platforms", () => {
    expect(registerPushTokenSchema.safeParse({
      expo_push_token: "ExpoPushToken[abc123]",
      platform: "web",
    }).success).toBe(false)
  })

  it("uses the same token rules when unregistering", () => {
    expect(unregisterPushTokenSchema.safeParse({ expo_push_token: "invalid" }).success).toBe(false)
  })
})
