import type { Metadata } from "next";
import { BanqueEtatDetailApiScreen } from "@/features/finances/apiScreens";
import { ApiWithId } from "@/features/finances/gates";

export const metadata: Metadata = { title: "État de rapprochement" };

export default function Page({ params }: PageProps<"/finances/banque/etats/[id]">) {
  return <ApiWithId params={params}>{(id) => <BanqueEtatDetailApiScreen id={id} />}</ApiWithId>;
}
