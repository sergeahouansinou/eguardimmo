import { afterEach, describe, expect, it, vi } from "vitest";
import { organizationJsonLd, serializeJsonLd } from "./jsonLd";
import { pageMetadata } from "./metadata";
import { SITEMAP_PATHS } from "./routes";

async function withSite<T>(load: () => Promise<T>): Promise<T> {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.exemple.fr");
  vi.resetModules();
  return load();
}

describe("référencement", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("sitemap : une URL absolue par page, accueil sans barre finale", async () => {
    const { default: sitemap } = await withSite(() => import("../app/sitemap"));
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toHaveLength(SITEMAP_PATHS.length);
    expect(urls).toContain("https://www.exemple.fr");
    expect(urls).toContain("https://www.exemple.fr/tarifs");
    expect(urls).toContain("https://www.exemple.fr/mentions-legales");
    expect(urls.every((url) => url.startsWith("https://www.exemple.fr"))).toBe(true);
  });

  it("robots : tout est autorisé sauf l’API, avec le plan du site", async () => {
    const { default: robots } = await withSite(() => import("../app/robots"));
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: "https://www.exemple.fr/sitemap.xml", host: "https://www.exemple.fr" });
  });

  it("métadonnées de page : canonique, Open Graph en français et image", () => {
    const metadata = pageMetadata({ title: "Tarifs", description: "Description.", path: "/tarifs" });
    expect(metadata.alternates?.canonical).toBe("/tarifs");
    expect(metadata.openGraph).toMatchObject({ locale: "fr_FR", type: "website", url: "/tarifs", siteName: "eGuardImmo", title: "Tarifs · eGuardImmo" });
    expect(JSON.stringify(metadata.openGraph?.images)).toContain("/logo.png");
  });

  it("JSON-LD Organization : champs publics seulement, aucun contact inventé", () => {
    const data = organizationJsonLd("https://www.exemple.fr");
    expect(data).toMatchObject({ "@context": "https://schema.org", "@type": "Organization", name: "eGuardImmo", url: "https://www.exemple.fr", logo: "https://www.exemple.fr/logo.png" });
    expect(Object.keys(data).sort()).toEqual(["@context", "@type", "description", "logo", "name", "url"]);
  });

  it("la sérialisation JSON-LD neutralise toute fermeture de balise script", () => {
    const serialized = serializeJsonLd({ name: "</script><img src=x onerror=alert(1)>" });
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual({ name: "</script><img src=x onerror=alert(1)>" });
  });
});
