import type { Metadata } from "next";
import "./globals.css";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { siteEnv } from "@/lib/env";
import { organizationJsonLd, serializeJsonLd } from "@/lib/jsonLd";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/metadata";

const siteUrl = siteEnv().NEXT_PUBLIC_SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${SITE_NAME} · Gestion locative pour agences, propriétaires et locataires`, template: `%s · ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  icons: { icon: "/logo.png" },
  openGraph: {
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: "fr_FR",
    type: "website",
    images: [{ url: "/logo.png", width: 230, height: 244, alt: SITE_NAME }],
  },
  twitter: { card: "summary" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-page font-sans text-prose text-fg">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-surface focus:px-4 focus:text-fg focus:outline-2 focus:outline-focus"
        >
          Aller au contenu
        </a>
        <SiteHeader />
        <main id="contenu" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <SiteFooter />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd(siteUrl)) }} />
      </body>
    </html>
  );
}
