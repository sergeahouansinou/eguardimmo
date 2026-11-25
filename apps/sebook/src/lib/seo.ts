import type { Metadata } from "next";
import { sebookEnv } from "@/lib/env";
import type { JsonLd } from "@/marketplace/jsonld";

export const SITE_NAME = "SeBook";

export const SITE_TAGLINE = "Réservez des logements : séjours et locations longue durée proposés par des agences et des propriétaires.";

export const LOGO_PATH = "/images/logo.avif";

export const TODO_MARK = "[À RENSEIGNER]";

export function pageTitle(name: string): string {
  return `${name} - ${SITE_NAME}`;
}

export function absoluteUrl(path: string): string {
  const site = sebookEnv().siteUrl;
  if (!path) return site;
  if (/^https?:\/\//i.test(path)) return path;
  return `${site}${path.startsWith("/") ? "" : "/"}${path}`;
}

export interface BreadcrumbItem {
  name: string;
  path?: string;
}

export function buildBreadcrumbJsonLd(crumbs: readonly BreadcrumbItem[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.path ? { item: absoluteUrl(crumb.path) } : {}),
    })),
  };
}

export function buildHomeJsonLd(): JsonLd[] {
  const site = absoluteUrl("/");
  return [
    { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: site, logo: absoluteUrl(LOGO_PATH) },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      url: site,
      inLanguage: "fr",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/destinations")}?place={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export function buildInfoPageJsonLd(input: {
  path: string;
  title: string;
  description: string;
  breadcrumb: readonly BreadcrumbItem[];
  faq?: readonly FaqEntry[];
}): JsonLd[] {
  const nodes: JsonLd[] = [
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: input.title,
      description: input.description,
      url: absoluteUrl(input.path),
      inLanguage: "fr",
      isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
    },
    buildBreadcrumbJsonLd(input.breadcrumb),
  ];
  const publishable = (input.faq ?? []).filter((entry) => !entry.answer.includes(TODO_MARK));
  if (publishable.length > 0) {
    nodes.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: publishable.map((entry) => ({
        "@type": "Question",
        name: entry.question,
        acceptedAnswer: { "@type": "Answer", text: entry.answer },
      })),
    });
  }
  return nodes;
}

export function infoMetadata(path: string, title: string, description: string): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, siteName: SITE_NAME, title, description },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const INFO_PATHS = [
  "/aide",
  "/conditions",
  "/confidentialite",
  "/annulation",
  "/securite",
  "/accessibilite",
  "/contact",
  "/signalement",
  "/ressources",
  "/presse",
  "/carrieres",
  "/anti-discrimination",
  "/conformite",
] as const;
