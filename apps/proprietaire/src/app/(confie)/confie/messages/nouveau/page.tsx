import { NewMessagePage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/features/confie/ui/States";
import { dataSource } from "@/lib/env";
import { NewMessageScreen } from "@/owner/conversations/screens";

export const metadata: Metadata = { title: "Nouveau message" };

export default function Page() {
  return <Suspense fallback={<PageSkeleton />}>{dataSource === "api" ? <NewMessageScreen /> : <NewMessagePage />}</Suspense>;
}
