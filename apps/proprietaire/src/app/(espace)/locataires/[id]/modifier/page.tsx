import { demoTenantIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { LocataireFormScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Modifier le locataire" };

export function generateStaticParams() {
  return demoTenantIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/locataires/[id]/modifier">) {
  return <WithId params={params}>{(id) => <LocataireFormScreen id={id} />}</WithId>;
}
