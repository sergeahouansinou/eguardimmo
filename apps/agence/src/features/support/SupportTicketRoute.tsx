import { SupportTicketPage } from "@eguardimmo/messagerie";
import { notFound } from "next/navigation";
import { isUuid } from "@/features/messagerie/ids";
import { dataSource } from "@/lib/env";

export async function SupportTicketRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (dataSource !== "api" || !isUuid(id)) notFound();
  return <SupportTicketPage ticketId={id} />;
}
