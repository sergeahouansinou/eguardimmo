import { demoLeaseIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { BailEcheancierScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Échéancier" };

export function generateStaticParams() {
  return demoLeaseIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/baux/[id]/echeancier">) {
  return <WithId params={params}>{(id) => <BailEcheancierScreen id={id} />}</WithId>;
}
