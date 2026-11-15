import { ImmeubleInterventions } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "../../../../WithId";

export const metadata: Metadata = { title: "Interventions de l’immeuble" };

export default function Page({ params }: PageProps<"/biens/immeubles/[id]/interventions">) {
  return <WithId params={params}>{(id) => <ImmeubleInterventions id={id} />}</WithId>;
}
