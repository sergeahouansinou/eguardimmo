import { EquipementDocuments } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Documents de l’équipement" };

export default function Page({ params }: PageProps<"/biens/equipements/[id]/documents">) {
  return <WithId params={params}>{(id) => <EquipementDocuments id={id} />}</WithId>;
}
