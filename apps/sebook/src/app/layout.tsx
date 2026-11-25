import type { Metadata } from "next";
import { Dancing_Script, Hanken_Grotesk, Playfair_Display, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { sebookEnv } from "@/lib/env";
import { Providers } from "./providers";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const schibsted = Schibsted_Grotesk({ variable: "--font-schibsted", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], weight: ["700"], preload: false });
const dancing = Dancing_Script({ variable: "--font-dancing", subsets: ["latin"], weight: ["700"], preload: false });

const TITLE = "SeBook, logements à réserver";
const DESCRIPTION = "Réservez des logements : séjours et locations longue durée proposés par des agences et des propriétaires.";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(sebookEnv().siteUrl),
    title: { default: TITLE, template: "%s · SeBook" },
    description: DESCRIPTION,
    applicationName: "SeBook",
    openGraph: { type: "website", siteName: "SeBook", locale: "fr_FR", title: TITLE, description: DESCRIPTION },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  const env = sebookEnv();
  return (
    <html lang="fr" className={`${hanken.variable} ${schibsted.variable} ${playfair.variable} ${dancing.variable}`} suppressHydrationWarning>
      <body>
        <Providers apiUrl={env.apiUrl} authUrl={env.authUrl}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
