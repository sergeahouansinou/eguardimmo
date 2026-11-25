import { HelpPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { dataSource } from "@/lib/env";
import { AideScreen } from "@/owner/help/AideScreen";

export const metadata: Metadata = { title: "Aide" };

export default function Page() {
  return <Suspense fallback={<PageSkeleton />}>{dataSource === "api" ? <AideScreen /> : <HelpPage />}</Suspense>;
}
