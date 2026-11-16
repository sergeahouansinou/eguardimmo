import { LotEquipements } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Équipements du lot" };

export default function Page({ params }: PageProps<"/biens/[id]/equipements">) {
  return <WithId params={params}>{(id) => <LotEquipements id={id} />}</WithId>;
}
