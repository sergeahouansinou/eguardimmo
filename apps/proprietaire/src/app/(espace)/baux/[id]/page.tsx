import { demoLeaseIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { BailDetailScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Bail" };

export function generateStaticParams() {
  return demoLeaseIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/baux/[id]">) {
  return <WithId params={params}>{(id) => <BailDetailScreen id={id} />}</WithId>;
}
