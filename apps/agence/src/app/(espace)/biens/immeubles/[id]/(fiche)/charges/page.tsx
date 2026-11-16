import { ImmeubleCharges } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Charges de l’immeuble" };

export default function Page({ params }: PageProps<"/biens/immeubles/[id]/charges">) {
  return <WithId params={params}>{(id) => <ImmeubleCharges id={id} />}</WithId>;
}
