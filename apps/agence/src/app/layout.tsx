import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Espace agence", template: "%s · eGuardImmo" },
  description: "Espace de gestion locative des agences eGuardImmo.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full bg-page font-sans text-body text-fg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
