import type { Metadata } from "next";
import { EtatLieuxScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "État des lieux" };

export default function Page({ params }: PageProps<"/baux/etats-des-lieux/[id]">) {
  return <WithId params={params}>{(id) => <EtatLieuxScreen id={id} />}</WithId>;
}
