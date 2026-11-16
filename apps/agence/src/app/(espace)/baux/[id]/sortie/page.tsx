import type { Metadata } from "next";
import { BailSortieScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Préavis et sortie" };

export default function Page({ params }: PageProps<"/baux/[id]/sortie">) {
  return <WithId params={params}>{(id) => <BailSortieScreen id={id} />}</WithId>;
}
