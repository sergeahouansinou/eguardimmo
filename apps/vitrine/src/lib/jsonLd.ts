import { SITE_DESCRIPTION, SITE_NAME } from "./metadata";

export function organizationJsonLd(siteUrl: string): Record<string, string> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description: SITE_DESCRIPTION,
  };
}

const ESCAPES: Record<string, string> = { "<": "\\u003c", "\u2028": "\\u2028", "\u2029": "\\u2029" };

export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/[<\u2028\u2029]/g, (char) => ESCAPES[char] ?? char);
}
