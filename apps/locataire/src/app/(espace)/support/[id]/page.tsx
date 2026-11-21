import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ScreenState";
import { SupportTicketRoute } from "@/features/support/SupportTicketRoute";

export const metadata: Metadata = { title: "Demande au support" };

export default function Page({ params }: PageProps<"/support/[id]">) {
  return (
    <Suspense fallback={<Skeleton rows={4} />}>
      <SupportTicketRoute params={params} />
    </Suspense>
  );
}
