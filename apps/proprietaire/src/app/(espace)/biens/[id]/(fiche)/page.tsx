import { LotOverview } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "../../WithId";

export const metadata: Metadata = { title: "Fiche du lot" };

export default function Page({ params }: PageProps<"/biens/[id]">) {
  return <WithId params={params}>{(id) => <LotOverview id={id} />}</WithId>;
}
