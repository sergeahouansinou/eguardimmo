import type { Metadata } from "next";
import { InvoiceScreen } from "@/owner/invoices/InvoiceScreen";
import { ApiOnly } from "@/owner/ApiOnly";
import { WithParam } from "@/owner/WithParam";

export const metadata: Metadata = { title: "Facture" };

export default function Page({ params }: PageProps<"/confie/factures/[id]">) {
  return (
    <ApiOnly>
      <WithParam params={params} name="id">
        {(id) => <InvoiceScreen id={id} />}
      </WithParam>
    </ApiOnly>
  );
}
