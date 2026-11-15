import { demoTenantIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { LocataireDetailScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Fiche locataire" };

export function generateStaticParams() {
  return demoTenantIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/locataires/[id]">) {
  return <WithId params={params}>{(id) => <LocataireDetailScreen id={id} />}</WithId>;
}
