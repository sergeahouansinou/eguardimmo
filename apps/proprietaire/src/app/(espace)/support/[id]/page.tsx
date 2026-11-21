import { SupportTicketPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WithParam } from "@/owner/WithParam";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Demande au support" };

export default function Page({ params }: PageProps<"/support/[id]">) {
  if (dataSource !== "api") notFound();
  return (
    <WithParam params={params} name="id">
      {(id) => <SupportTicketPage ticketId={id} />}
    </WithParam>
  );
}
