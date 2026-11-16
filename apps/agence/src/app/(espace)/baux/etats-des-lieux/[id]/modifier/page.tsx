import type { Metadata } from "next";
import { EtatLieuxFormScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Modifier l’état des lieux" };

export default function Page({ params }: PageProps<"/baux/etats-des-lieux/[id]/modifier">) {
  return <WithId params={params}>{(id) => <EtatLieuxFormScreen id={id} />}</WithId>;
}
