import { SupportTicketPage } from "@eguardimmo/messagerie";
import type { Metadata } from "next";
import { ApiOnly } from "@/owner/ApiOnly";
import { WithParam } from "@/owner/WithParam";

export const metadata: Metadata = { title: "Demande au support" };

export default function Page({ params }: PageProps<"/confie/support/[id]">) {
  return (
    <ApiOnly>
      <WithParam params={params} name="id">
        {(id) => <SupportTicketPage ticketId={id} />}
      </WithParam>
    </ApiOnly>
  );
}
