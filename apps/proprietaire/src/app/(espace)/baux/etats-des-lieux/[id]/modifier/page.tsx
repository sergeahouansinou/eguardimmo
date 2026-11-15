import { demoEdlIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { EtatLieuxFormScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Modifier l’état des lieux" };

export function generateStaticParams() {
  return demoEdlIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/baux/etats-des-lieux/[id]/modifier">) {
  return <WithId params={params}>{(id) => <EtatLieuxFormScreen id={id} />}</WithId>;
}
