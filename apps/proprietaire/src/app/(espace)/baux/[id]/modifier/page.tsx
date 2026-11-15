import { demoLeaseIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { BailFormScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Modifier le bail" };

export function generateStaticParams() {
  return demoLeaseIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/baux/[id]/modifier">) {
  return <WithId params={params}>{(id) => <BailFormScreen id={id} />}</WithId>;
}
