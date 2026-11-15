import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { PaymentFormPage } from "@/features/finances/encaissements/PaymentFormPage";

export const metadata: Metadata = { title: "Saisir un paiement" };

export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PaymentFormPage />
    </Suspense>
  );
}
