import { EquipementForm } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "../../../WithId";

export const metadata: Metadata = { title: "Modifier l’équipement" };

export default function Page({ params }: PageProps<"/biens/equipements/[id]/modifier">) {
  return <WithId params={params}>{(id) => <EquipementForm id={id} />}</WithId>;
}
