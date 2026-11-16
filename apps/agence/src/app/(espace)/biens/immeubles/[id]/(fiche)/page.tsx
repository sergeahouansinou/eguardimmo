import { ImmeubleOverview } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Fiche de l’immeuble" };

export default function Page({ params }: PageProps<"/biens/immeubles/[id]">) {
  return <WithId params={params}>{(id) => <ImmeubleOverview id={id} />}</WithId>;
}
