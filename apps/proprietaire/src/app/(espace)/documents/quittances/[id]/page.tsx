import { demoReceiptIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { QuittanceApercuScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Quittance" };

export function generateStaticParams() {
  return demoReceiptIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/documents/quittances/[id]">) {
  return <WithId params={params}>{(id) => <QuittanceApercuScreen id={id} />}</WithId>;
}
