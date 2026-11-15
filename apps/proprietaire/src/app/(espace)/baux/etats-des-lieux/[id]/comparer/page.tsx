import { demoEdlIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { EtatLieuxCompareScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Comparer avec l’entrée" };

export function generateStaticParams() {
  return demoEdlIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/baux/etats-des-lieux/[id]/comparer">) {
  return <WithId params={params}>{(id) => <EtatLieuxCompareScreen id={id} />}</WithId>;
}
