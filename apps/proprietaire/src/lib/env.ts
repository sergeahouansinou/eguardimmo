import { publicEnvSchema } from "@eguardimmo/config/env/public";

export const env = publicEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});
