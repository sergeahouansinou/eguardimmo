import { EquipementInterventions } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "../../../../WithId";

export const metadata: Metadata = { title: "Interventions de l’équipement" };

export default function Page({ params }: PageProps<"/biens/equipements/[id]/interventions">) {
  return <WithId params={params}>{(id) => <EquipementInterventions id={id} />}</WithId>;
}
