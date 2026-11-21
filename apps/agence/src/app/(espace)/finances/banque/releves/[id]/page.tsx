import type { Metadata } from "next";
import { BanqueReleveDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Relevé bancaire" };

export default function Page({ params }: PageProps<"/finances/banque/releves/[id]">) {
  return <WithId params={params}>{(id) => <BanqueReleveDetailScreen id={id} />}</WithId>;
}
