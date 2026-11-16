import type { Metadata } from "next";
import { BailFormScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Modifier le bail" };

export default function Page({ params }: PageProps<"/baux/[id]/modifier">) {
  return <WithId params={params}>{(id) => <BailFormScreen id={id} />}</WithId>;
}
