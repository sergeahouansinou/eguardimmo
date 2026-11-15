import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfieProviders } from "@/confie-config/ConfieProviders";
import { ConfieShell } from "@/confie-config/ConfieShell";

export const metadata: Metadata = {
  title: { default: "Espace propriétaire", template: "%s · eGuardImmo" },
  description: "Consultation des biens confiés à une agence.",
};

export default function ConfieLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <ConfieProviders>
        <ConfieShell>{children}</ConfieShell>
      </ConfieProviders>
    </Suspense>
  );
}
