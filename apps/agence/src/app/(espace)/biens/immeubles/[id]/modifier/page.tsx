import { ImmeubleForm } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Modifier l’immeuble" };

export default function Page({ params }: PageProps<"/biens/immeubles/[id]/modifier">) {
  return <WithId params={params}>{(id) => <ImmeubleForm id={id} />}</WithId>;
}
