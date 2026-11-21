import type { Metadata } from "next";
import { LoyerQuittanceDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Quittance de loyer" };

export default function Page({ params }: PageProps<"/finances/loyers/quittances/[id]">) {
  return <WithId params={params}>{(id) => <LoyerQuittanceDetailScreen id={id} />}</WithId>;
}
