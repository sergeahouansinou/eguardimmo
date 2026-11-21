import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { LinksScreen } from "@/features/acces/LinksScreen";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Mes accès" };

export default function Page() {
  if (dataSource !== "api") notFound();
  return (
    <Suspense fallback={<Skeleton rows={2} />}>
      <LinksScreen />
    </Suspense>
  );
}
