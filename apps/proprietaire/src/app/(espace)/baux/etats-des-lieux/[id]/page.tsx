import { demoEdlIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { EtatLieuxScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "État des lieux" };

export function generateStaticParams() {
  return demoEdlIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/baux/etats-des-lieux/[id]">) {
  return <WithId params={params}>{(id) => <EtatLieuxScreen id={id} />}</WithId>;
}
