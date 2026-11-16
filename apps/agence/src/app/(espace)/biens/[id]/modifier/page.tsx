import { LotForm } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Modifier le lot" };

export default function Page({ params }: PageProps<"/biens/[id]/modifier">) {
  return <WithId params={params}>{(id) => <LotForm id={id} />}</WithId>;
}
