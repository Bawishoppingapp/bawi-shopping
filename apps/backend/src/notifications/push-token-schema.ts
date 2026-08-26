import { z } from "@medusajs/framework/zod"

/** Expo currently issues tokens in either the ExpoPushToken or legacy
 * ExponentPushToken form. Keep malformed or unbounded input out of storage
 * and away from Expo's push API while accepting both supported formats. */
export const expoPushTokenSchema = z
  .string()
  .trim()
  .max(256)
  .regex(/^(?:Expo|Exponent)PushToken\[[^\]\r\n]+\]$/, "Invalid Expo push token")

export const registerPushTokenSchema = z.object({
  expo_push_token: expoPushTokenSchema,
  platform: z.enum(["ios", "android"]).optional(),
})

export const unregisterPushTokenSchema = z.object({
  expo_push_token: expoPushTokenSchema,
})
