import { LotFinances } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Finances du lot" };

export default function Page({ params }: PageProps<"/biens/[id]/finances">) {
  return <WithId params={params}>{(id) => <LotFinances id={id} />}</WithId>;
}
