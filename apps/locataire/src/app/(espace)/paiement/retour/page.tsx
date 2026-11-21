import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ApiPaymentReturnScreen } from "@/features/loyers/ApiPaymentReturnScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Retour de paiement" };

export default function Page() {
  if (dataSource !== "api") notFound();
  return (
    <Suspense fallback={<Skeleton />}>
      <ApiPaymentReturnScreen />
    </Suspense>
  );
}
