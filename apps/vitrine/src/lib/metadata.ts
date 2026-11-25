import type { Metadata } from "next";

export const SITE_NAME = "eGuardImmo";
export const SITE_DESCRIPTION =
  "Logiciel de gestion locative : baux, loyers, mandats, fonds des propriétaires, états des lieux et messagerie, avec un espace pour l’agence, le propriétaire et le locataire.";

interface PageMetadataInput {
  title: string;
  description: string;
  path: string;
}

export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "fr_FR",
      type: "website",
      images: [{ url: "/logo.png", width: 230, height: 244, alt: SITE_NAME }],
    },
    twitter: { card: "summary", title: `${title} · ${SITE_NAME}`, description },
  };
}
