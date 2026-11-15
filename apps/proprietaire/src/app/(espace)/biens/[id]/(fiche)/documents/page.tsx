import { LotDocuments } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "../../../WithId";

export const metadata: Metadata = { title: "Documents du lot" };

export default function Page({ params }: PageProps<"/biens/[id]/documents">) {
  return <WithId params={params}>{(id) => <LotDocuments id={id} />}</WithId>;
}
