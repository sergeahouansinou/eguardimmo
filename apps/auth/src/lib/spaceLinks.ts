import { spaceUrl } from "@eguardimmo/shell";
import { homeUrlOfApp } from "./returnTo";
import type { ReturnTo } from "./returnTo";
import { appOfProfile } from "./spaces";
import type { ProfileKind } from "./spaces";

const MANDANT_HOME = "/confie";

function homePathOf(kind: ProfileKind): string {
  return kind === "proprietaire" ? MANDANT_HOME : "/";
}

function homeUrlOfProfile(kind: ProfileKind): string | null {
  const app = appOfProfile(kind);
  if (app === "sebook") return homeUrlOfApp(app);
  try {
    return spaceUrl(app, homePathOf(kind));
  } catch {
    return null;
  }
}

export function destinationOfProfile(kind: ProfileKind, returnTo: ReturnTo): string | null {
  if (returnTo.status === "ok" && returnTo.app !== null && returnTo.app === appOfProfile(kind)) return returnTo.url;
  return homeUrlOfProfile(kind);
}
