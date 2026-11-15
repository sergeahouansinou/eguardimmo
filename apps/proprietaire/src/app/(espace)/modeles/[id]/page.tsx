import { demoTemplateIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { ModeleApercuScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Modèle de courrier" };

export function generateStaticParams() {
  return demoTemplateIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/modeles/[id]">) {
  return <WithId params={params}>{(id) => <ModeleApercuScreen id={id} />}</WithId>;
}
