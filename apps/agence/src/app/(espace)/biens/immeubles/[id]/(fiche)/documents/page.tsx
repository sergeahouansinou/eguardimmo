import { ImmeubleDocuments } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Documents de l’immeuble" };

export default function Page({ params }: PageProps<"/biens/immeubles/[id]/documents">) {
  return <WithId params={params}>{(id) => <ImmeubleDocuments id={id} />}</WithId>;
}
