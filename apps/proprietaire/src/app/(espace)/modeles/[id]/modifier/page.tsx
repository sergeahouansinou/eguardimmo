import { demoTemplateIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { ModeleFormScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Modifier le modèle" };

export function generateStaticParams() {
  return demoTemplateIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/modeles/[id]/modifier">) {
  return <WithId params={params}>{(id) => <ModeleFormScreen id={id} />}</WithId>;
}
