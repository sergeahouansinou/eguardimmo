import { SupportNewRequestPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Nouvelle demande au support" };

export default function Page() {
  if (dataSource !== "api") notFound();
  return (
    <Suspense fallback={<Skeleton rows={3} />}>
      <SupportNewRequestPage />
    </Suspense>
  );
}
