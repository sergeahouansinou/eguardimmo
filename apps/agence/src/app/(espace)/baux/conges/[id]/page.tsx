import type { Metadata } from "next";
import { CongeDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Demande de congé" };

export default function Page({ params }: PageProps<"/baux/conges/[id]">) {
  return <WithId params={params}>{(id) => <CongeDetailScreen id={id} />}</WithId>;
}
