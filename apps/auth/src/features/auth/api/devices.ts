import type { AuthSource } from "../source";
import { unavailable } from "./shared";
import type { AuthContext } from "./shared";

type DeviceMethods = Pick<AuthSource, "signOutDevice" | "signOutOtherDevices">;

export function deviceMethods({ client }: AuthContext): DeviceMethods {
  return {
    signOutDevice: async (deviceId) => {
      await client.delete(`/api/v1/me/devices/${encodeURIComponent(deviceId)}`);
    },
    signOutOtherDevices: unavailable(),
  };
}
