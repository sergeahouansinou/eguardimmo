import { EquipementEntretien } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "../../../../WithId";

export const metadata: Metadata = { title: "Entretien de l’équipement" };

export default function Page({ params }: PageProps<"/biens/equipements/[id]/entretien">) {
  return <WithId params={params}>{(id) => <EquipementEntretien id={id} />}</WithId>;
}
