import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { PaymentsScreen } from "@/features/rent/PaymentsScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Mes paiements" };

export default function Page() {
  if (dataSource !== "api") notFound();
  return (
    <Suspense fallback={<Skeleton />}>
      <PaymentsScreen />
    </Suspense>
  );
}
