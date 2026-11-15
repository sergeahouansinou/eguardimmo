import { LotCompteurs } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "../../../WithId";

export const metadata: Metadata = { title: "Compteurs du lot" };

export default function Page({ params }: PageProps<"/biens/[id]/compteurs">) {
  return <WithId params={params}>{(id) => <LotCompteurs id={id} />}</WithId>;
}
