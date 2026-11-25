import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorMessage, NotFoundMessage } from "@/components/roost/SystemMessage";
import { INFO_PATHS, absoluteUrl, buildHomeJsonLd, buildInfoPageJsonLd } from "@/lib/seo";
import { clearPublicReads } from "@/marketplace/cached";
import { REF, REF_2, SUMMARY, SUMMARY_LONG } from "@/marketplace/responses.fixtures";
import { serializeJsonLd } from "@/marketplace/jsonld";
import { renderApp, stubApi } from "../../test/api";
import { expectNoA11yViolations } from "../../test/axe";
import robots from "./robots";
import { GET as sitemap } from "./sitemap.xml/route";

vi.mock("next/server", () => ({ connection: () => Promise.resolve() }));
vi.mock("@/components/roost/Header", () => ({ default: () => <header aria-label="En-tête" /> }));

const SITE = "http://sebook.test";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function stubCatalogue(status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (status !== 200) return Promise.resolve(json({}, status));
      const long = url.searchParams.get("kind") === "long_term";
      const items = long ? [SUMMARY_LONG] : [SUMMARY];
      return Promise.resolve(json({ data: items, meta: { has_more: false, next_cursor: null } }));
    }),
  );
}

afterEach(() => {
  clearPublicReads();
  vi.unstubAllGlobals();
});

describe("robots.txt", () => {
  it("autorise le site public et interdit les espaces privés", () => {
    const result = robots();
    expect(result.rules).toEqual([{ userAgent: "*", allow: "/", disallow: ["/compte", "/favorites", "/listings/*/reserve"] }]);
    expect(result.sitemap).toBe(`${SITE}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  it("liste accueil, destinations, annonces publiées et pages d’information", async () => {
    stubCatalogue();
    const response = await sitemap();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/xml");
    const urls = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    expect(urls).toEqual(expect.arrayContaining([`${SITE}/`, `${SITE}/destinations`, `${SITE}/listings/${REF}`, `${SITE}/listings/${REF_2}`]));
    for (const path of INFO_PATHS) expect(urls).toContain(`${SITE}${path}`);
    expect(urls).toHaveLength(2 + 2 + INFO_PATHS.length);
    expect(urls.some((url) => /\/(compte|favorites|reserve)/.test(url ?? ""))).toBe(false);
  });

  it.each([429, 503])("API en %s : répond 503 avec Retry-After, sans lever d’exception ni plan incomplet", async (status) => {
    stubCatalogue(status);
    const response = await sitemap();
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("300");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain("<urlset");
  });

  it("interroge l’API au plus grand format de page pour limiter les appels", async () => {
    stubCatalogue();
    await sitemap();
    const fetchMock = vi.mocked(fetch);
    const perPage = fetchMock.mock.calls.map(([input]) => new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url).searchParams.get("per_page"));
    expect(perPage.every((value) => value === "24")).toBe(true);
  });
});

describe("JSON-LD", () => {
  it("décrit l’organisation et la recherche du site depuis l’URL configurée", () => {
    const [organization, website] = buildHomeJsonLd();
    expect(organization).toMatchObject({ "@type": "Organization", name: "SeBook", url: `${SITE}/` });
    expect(website).toMatchObject({
      "@type": "WebSite",
      potentialAction: { "@type": "SearchAction", target: { urlTemplate: `${SITE}/destinations?place={search_term_string}` } },
    });
    expect(absoluteUrl("/aide")).toBe(`${SITE}/aide`);
  });

  it("construit le fil d’Ariane et n’expose que les questions entièrement renseignées", () => {
    const nodes = buildInfoPageJsonLd({
      path: "/aide",
      title: "Aide",
      description: "Description",
      breadcrumb: [{ name: "Accueil", path: "/" }, { name: "Aide" }],
      faq: [
        { question: "Q1", answer: "R1" },
        { question: "Q2", answer: "R2 : [À RENSEIGNER]" },
      ],
    });
    expect(nodes[1]).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [{ position: 1, item: `${SITE}/` }, { position: 2, name: "Aide" }],
    });
    expect(nodes[2]).toMatchObject({ "@type": "FAQPage", mainEntity: [{ name: "Q1" }] });
    expect(serializeJsonLd(nodes[0] ?? {})).not.toContain("<");
  });
});

describe("pages système", () => {
  it("propose de revenir à l’accueil ou de parcourir les logements en 404", async () => {
    stubApi();
    const { container } = renderApp(<NotFoundMessage />);
    expect(screen.getByRole("heading", { level: 1, name: "Cette page n’existe pas" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Retour à l’accueil" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Parcourir les logements" }).getAttribute("href")).toBe("/destinations");
    await expectNoA11yViolations(container);
  });

  it("annonce l’erreur et relance au clic", async () => {
    stubApi();
    const retry = vi.fn();
    const { user, container } = renderApp(<ErrorMessage onRetry={retry} />);
    expect(screen.getByRole("alert").textContent).toContain("Une erreur est survenue");
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(retry).toHaveBeenCalledTimes(1);
    await expectNoA11yViolations(container);
  });
});
