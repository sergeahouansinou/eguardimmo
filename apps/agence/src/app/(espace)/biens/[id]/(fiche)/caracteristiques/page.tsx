import { LotCarac } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Caractéristiques du lot" };

export default function Page({ params }: PageProps<"/biens/[id]/caracteristiques">) {
  return <WithId params={params}>{(id) => <LotCarac id={id} />}</WithId>;
}
