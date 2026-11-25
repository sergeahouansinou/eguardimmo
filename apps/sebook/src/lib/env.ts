import { createPublicEnvSchema } from "@eguardimmo/config/env/public";
import { z } from "zod";

const DEV_SITE_URL = "http://localhost:3060";

const HTTPS_REQUIRED = "doit être en https en production.";

export function sebookEnvSchema(nodeEnv: string | undefined) {
  const production = nodeEnv === "production";
  const siteUrl = z.url();
  return createPublicEnvSchema(nodeEnv)
    .extend({ NEXT_PUBLIC_SITE_URL: production ? siteUrl : siteUrl.default(DEV_SITE_URL) })
    .superRefine((env, context) => {
      if (!production) return;
      for (const key of ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_SITE_URL"] as const) {
        if (!env[key].startsWith("https://")) context.addIssue({ code: "custom", path: [key], message: `${key} ${HTTPS_REQUIRED}` });
      }
    });
}

export interface SebookEnv {
  apiUrl: string;
  authUrl: string | undefined;
  siteUrl: string;
}

let parsed: SebookEnv | null = null;

// Next n'inline que les lectures littérales de process.env.NEXT_PUBLIC_*.
export function sebookEnv(): SebookEnv {
  if (parsed) return parsed;
  const env = sebookEnvSchema(process.env.NODE_ENV).parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_DATA_SOURCE: process.env.NEXT_PUBLIC_DATA_SOURCE,
    NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (env.NEXT_PUBLIC_DATA_SOURCE !== "api") {
    throw new Error("SeBook n’a pas de mode démonstration : NEXT_PUBLIC_DATA_SOURCE doit valoir api.");
  }
  parsed = { apiUrl: env.NEXT_PUBLIC_API_URL, authUrl: env.NEXT_PUBLIC_AUTH_URL, siteUrl: new URL(env.NEXT_PUBLIC_SITE_URL).origin };
  return parsed;
}
