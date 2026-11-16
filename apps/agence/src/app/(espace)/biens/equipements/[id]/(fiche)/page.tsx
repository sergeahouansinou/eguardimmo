import { EquipementOverview } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Fiche de l’équipement" };

export default function Page({ params }: PageProps<"/biens/equipements/[id]">) {
  return <WithId params={params}>{(id) => <EquipementOverview id={id} />}</WithId>;
}
