import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportTicketRoute } from "@/features/support/SupportTicketRoute";

export const metadata: Metadata = { title: "Demande au support" };

export default function Page({ params }: PageProps<"/support/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="h-7 w-48 animate-pulse rounded-sm bg-muted" />}>
      <SupportTicketRoute params={params} />
    </Suspense>
  );
}
