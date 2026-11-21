import type { Metadata } from "next";
import { EvenementDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Événement" };

export default function Page({ params }: PageProps<"/agenda/[id]">) {
  return <WithId params={params}>{(id) => <EvenementDetailScreen id={id} />}</WithId>;
}
