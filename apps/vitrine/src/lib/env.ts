import { z } from "zod";

const DEV_URLS = {
  NEXT_PUBLIC_SITE_URL: "http://localhost:3070",
  NEXT_PUBLIC_AUTH_URL: "http://localhost:3040",
  NEXT_PUBLIC_AGENCE_URL: "http://localhost:3010",
  NEXT_PUBLIC_PROPRIETAIRE_URL: "http://localhost:3020",
  NEXT_PUBLIC_LOCATAIRE_URL: "http://localhost:3030",
  NEXT_PUBLIC_SEBOOK_URL: "http://localhost:3060",
} as const;

type UrlVariable = keyof typeof DEV_URLS;

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".localhost") || hostname.endsWith(".test");
}

export function parseOrigin(raw: string, production: boolean): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const protocolAllowed = url.protocol === "https:" || (url.protocol === "http:" && (!production || isLocalHost(url.hostname)));
  const bare = url.username === "" && url.password === "" && url.pathname === "/" && url.search === "" && url.hash === "";
  return protocolAllowed && bare ? url.origin : null;
}

function originSchema(variable: string, production: boolean) {
  return z
    .string({ error: `${variable} est obligatoire.` })
    .trim()
    .transform((value, ctx) => {
      const origin = parseOrigin(value, production);
      if (origin === null) {
        ctx.issues.push({
          code: "custom",
          message: `${variable} doit être une origine https:// sans chemin ni identifiants (http:// n’est admis que pour un hôte local).`,
          input: value,
        });
        return z.NEVER;
      }
      return origin;
    });
}

function createEnvSchema(production: boolean) {
  const url = (variable: UrlVariable) => {
    const schema = originSchema(variable, production);
    return production ? schema : schema.prefault(DEV_URLS[variable]);
  };
  return z.object({
    NEXT_PUBLIC_SITE_URL: url("NEXT_PUBLIC_SITE_URL"),
    NEXT_PUBLIC_AUTH_URL: url("NEXT_PUBLIC_AUTH_URL"),
    NEXT_PUBLIC_AGENCE_URL: url("NEXT_PUBLIC_AGENCE_URL"),
    NEXT_PUBLIC_PROPRIETAIRE_URL: url("NEXT_PUBLIC_PROPRIETAIRE_URL"),
    NEXT_PUBLIC_LOCATAIRE_URL: url("NEXT_PUBLIC_LOCATAIRE_URL"),
    NEXT_PUBLIC_SEBOOK_URL: url("NEXT_PUBLIC_SEBOOK_URL"),
    NEXT_PUBLIC_CONTACT_EMAIL: z.email().max(254).optional(),
    NEXT_PUBLIC_PLAN_PRICES: z.string().max(2000).optional(),
  });
}

export type SiteEnv = z.infer<ReturnType<typeof createEnvSchema>>;

export function parseSiteEnv(source: Record<string, string | undefined>, nodeEnv: string | undefined): SiteEnv {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ""));
  return createEnvSchema(nodeEnv === "production").parse(cleaned);
}

let parsed: SiteEnv | null = null;

// Next n'inline que les lectures littérales de process.env.NEXT_PUBLIC_*.
export function siteEnv(): SiteEnv {
  parsed ??= parseSiteEnv(
    {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_AUTH_URL: process.env.NEXT_PUBLIC_AUTH_URL,
      NEXT_PUBLIC_AGENCE_URL: process.env.NEXT_PUBLIC_AGENCE_URL,
      NEXT_PUBLIC_PROPRIETAIRE_URL: process.env.NEXT_PUBLIC_PROPRIETAIRE_URL,
      NEXT_PUBLIC_LOCATAIRE_URL: process.env.NEXT_PUBLIC_LOCATAIRE_URL,
      NEXT_PUBLIC_SEBOOK_URL: process.env.NEXT_PUBLIC_SEBOOK_URL,
      NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
      NEXT_PUBLIC_PLAN_PRICES: process.env.NEXT_PUBLIC_PLAN_PRICES,
    },
    process.env.NODE_ENV,
  );
  return parsed;
}
