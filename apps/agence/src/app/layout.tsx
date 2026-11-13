import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "eGuardImmo — Agence",
  description: "Espace de gestion locative des agences eGuardImmo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-page font-sans text-body text-fg">{children}</body>
    </html>
  );
}
