import type { Metadata } from "next";
import { ChargesDecompteScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Décompte de charges" };

export default function Page({ params }: PageProps<"/finances/charges/decomptes/[id]">) {
  return <WithId params={params}>{(id) => <ChargesDecompteScreen id={id} />}</WithId>;
}
