import { isIP } from "node:net";
import { headers } from "next/headers";

// Seule la dernière entrée est écrite par le proxy : les précédentes sont au choix du visiteur.
export async function visitorIp(): Promise<string | null> {
  const candidate = (await headers()).get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "";
  return isIP(candidate) === 0 ? null : candidate;
}
