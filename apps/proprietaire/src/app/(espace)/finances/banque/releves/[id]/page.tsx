import type { Metadata } from "next";
import { BanqueReleveDetailApiScreen } from "@/features/finances/apiScreens";
import { ApiWithId } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Relevé bancaire" };

export default function Page({ params }: PageProps<"/finances/banque/releves/[id]">) {
  return <ApiWithId params={params}>{(id) => <BanqueReleveDetailApiScreen id={id} />}</ApiWithId>;
}
