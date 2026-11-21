import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SupportPage } from "@/features/aide/SupportPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Discuter avec le support" };

export default function Page() {
  if (dataSource === "api") redirect("/support");
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <SupportPage />
    </Suspense>
  );
}
