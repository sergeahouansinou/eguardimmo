import { ImmeubleCharges } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "../../../../WithId";

export const metadata: Metadata = { title: "Charges de l’immeuble" };

export default function Page({ params }: PageProps<"/biens/immeubles/[id]/charges">) {
  return <WithId params={params}>{(id) => <ImmeubleCharges id={id} />}</WithId>;
}
