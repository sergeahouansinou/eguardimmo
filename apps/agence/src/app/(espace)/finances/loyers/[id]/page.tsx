import type { Metadata } from "next";
import { LoyerDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Échéance de loyer" };

export default function Page({ params }: PageProps<"/finances/loyers/[id]">) {
  return <WithId params={params}>{(id) => <LoyerDetailScreen id={id} />}</WithId>;
}
