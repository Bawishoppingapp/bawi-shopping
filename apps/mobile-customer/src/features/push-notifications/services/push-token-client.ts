// Thin client over /store/push-tokens and /seller/push-tokens - shares
// one implementation since both routes have an identical contract (only
// the auth scope differs, matching how the backend mirrors the two route
// files). See apps/backend/src/api/store/push-tokens/route.ts.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";
const MEDUSA_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? "";

export type PushTokenScope = "customer" | "seller";

function pathFor(scope: PushTokenScope): string {
  return scope === "customer" ? "/store/push-tokens" : "/seller/push-tokens";
}

function headersFor(scope: PushTokenScope, sessionToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  };
  if (scope === "customer") {
    headers["x-publishable-api-key"] = MEDUSA_PUBLISHABLE_KEY;
  }
  return headers;
}

export async function registerPushToken(
  scope: PushTokenScope,
  sessionToken: string,
  expoPushToken: string,
  platform: "ios" | "android"
): Promise<boolean> {
  try {
    const response = await fetch(`${MEDUSA_BACKEND_URL}${pathFor(scope)}`, {
      method: "POST",
      headers: headersFor(scope, sessionToken),
      body: JSON.stringify({ expo_push_token: expoPushToken, platform }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function unregisterPushToken(
  scope: PushTokenScope,
  sessionToken: string,
  expoPushToken: string
): Promise<boolean> {
  try {
    const response = await fetch(`${MEDUSA_BACKEND_URL}${pathFor(scope)}`, {
      method: "DELETE",
      headers: headersFor(scope, sessionToken),
      body: JSON.stringify({ expo_push_token: expoPushToken }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
