import type { Metadata } from "next";
import { InvoicesScreen } from "@/owner/invoices/InvoicesScreen";
import { ApiOnly } from "@/owner/ApiOnly";

export const metadata: Metadata = { title: "Factures d’honoraires" };

export default function Page() {
  return (
    <ApiOnly>
      <InvoicesScreen />
    </ApiOnly>
  );
}
