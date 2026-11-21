import type { Metadata } from "next";
import { ChargesDecompteApiScreen } from "@/features/finances/apiScreens";
import { ApiWithId } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Décompte de charges" };

export default function Page({ params }: PageProps<"/finances/charges/decomptes/[id]">) {
  return <ApiWithId params={params}>{(id) => <ChargesDecompteApiScreen id={id} />}</ApiWithId>;
}
