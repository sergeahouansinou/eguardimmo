import { SupportNewRequestPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Nouvelle demande au support" };

export default function Page() {
  if (dataSource !== "api") notFound();
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <SupportNewRequestPage />
    </Suspense>
  );
}
