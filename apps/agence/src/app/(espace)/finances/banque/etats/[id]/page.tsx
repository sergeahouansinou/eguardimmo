import type { Metadata } from "next";
import { BanqueEtatDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "État de rapprochement" };

export default function Page({ params }: PageProps<"/finances/banque/etats/[id]">) {
  return <WithId params={params}>{(id) => <BanqueEtatDetailScreen id={id} />}</WithId>;
}
