import type { Metadata } from "next";
import { FactureDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Facture" };

export default function Page({ params }: PageProps<"/finances/factures/[id]">) {
  return <WithId params={params}>{(id) => <FactureDetailScreen id={id} />}</WithId>;
}
