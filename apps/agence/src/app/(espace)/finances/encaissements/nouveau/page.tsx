import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { PaymentFormPage } from "@/features/finances/encaissements/PaymentFormPage";
import { LoyerPaiementFormScreen } from "@/features/gestion/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Saisir un paiement" };

export default function Page() {
  if (dataSource === "api") return <LoyerPaiementFormScreen />;
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PaymentFormPage />
    </Suspense>
  );
}
