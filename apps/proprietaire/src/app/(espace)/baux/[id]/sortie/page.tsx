import { demoLeaseIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { BailSortieScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Préavis et sortie" };

export function generateStaticParams() {
  return demoLeaseIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/baux/[id]/sortie">) {
  return <WithId params={params}>{(id) => <BailSortieScreen id={id} />}</WithId>;
}
