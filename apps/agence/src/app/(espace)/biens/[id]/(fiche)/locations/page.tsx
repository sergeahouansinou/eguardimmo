import { LotLocations } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Locations du lot" };

export default function Page({ params }: PageProps<"/biens/[id]/locations">) {
  return <WithId params={params}>{(id) => <LotLocations id={id} />}</WithId>;
}
