import type { Metadata } from "next";
import { BailEcheancierScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Échéancier" };

export default function Page({ params }: PageProps<"/baux/[id]/echeancier">) {
  return <WithId params={params}>{(id) => <BailEcheancierScreen id={id} />}</WithId>;
}
