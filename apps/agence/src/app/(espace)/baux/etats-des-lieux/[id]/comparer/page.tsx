import type { Metadata } from "next";
import { EtatLieuxCompareScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Comparer avec l’entrée" };

export default function Page({ params }: PageProps<"/baux/etats-des-lieux/[id]/comparer">) {
  return <WithId params={params}>{(id) => <EtatLieuxCompareScreen id={id} />}</WithId>;
}
