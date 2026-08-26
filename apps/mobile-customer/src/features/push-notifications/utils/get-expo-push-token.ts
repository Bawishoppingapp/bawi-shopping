import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Resolves a device's Expo push token, or null if push isn't available in
 * this build. This deliberately fails soft rather than throwing, because
 * none of the following are guaranteed in every environment this runs in:
 *  - a physical device (the simulator/emulator has no push capability)
 *  - a real EAS project id in app.json's extra.eas.projectId (still a
 *    placeholder until `eas init`/`eas build:configure` is run - see
 *    CLAUDE.md)
 *  - a custom dev client (plain Expo Go cannot receive remote push as of
 *    SDK 53, and getExpoPushTokenAsync itself still works there for
 *    obtaining a token, but the token is only useful once eas/dev-client
 *    push delivery is actually wired up)
 *  - the user having granted notification permission
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || projectId === "REPLACE_WITH_REAL_EAS_PROJECT_ID") {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}
