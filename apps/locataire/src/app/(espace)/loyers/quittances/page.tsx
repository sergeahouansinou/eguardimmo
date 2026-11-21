import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { ReceiptsScreen } from "@/features/rent/ReceiptsScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Mes quittances" };

export default function Page() {
  if (dataSource !== "api") notFound();
  return (
    <Suspense fallback={<Skeleton />}>
      <ReceiptsScreen />
    </Suspense>
  );
}
