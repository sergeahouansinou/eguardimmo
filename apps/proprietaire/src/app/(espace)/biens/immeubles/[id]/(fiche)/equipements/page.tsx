import { ImmeubleEquipements } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "../../../../WithId";

export const metadata: Metadata = { title: "Équipements communs" };

export default function Page({ params }: PageProps<"/biens/immeubles/[id]/equipements">) {
  return <WithId params={params}>{(id) => <ImmeubleEquipements id={id} />}</WithId>;
}
