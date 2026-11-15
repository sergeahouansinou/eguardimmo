import { publicEnvSchema } from "@eguardimmo/config/env/public";
import type { PublicEnv } from "@eguardimmo/config/env/public";

export const dataSource = publicEnvSchema.shape.NEXT_PUBLIC_DATA_SOURCE.parse(process.env.NEXT_PUBLIC_DATA_SOURCE);

let parsed: PublicEnv | null = null;

export function apiEnv(): PublicEnv {
  parsed ??= publicEnvSchema.parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
    NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
  });
  return parsed;
}
