import { SupportRequestsPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Support" };

export default function Page() {
  if (dataSource !== "api") notFound();
  return (
    <Suspense fallback={<Skeleton />}>
      <SupportRequestsPage />
    </Suspense>
  );
}
