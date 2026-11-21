import type { Metadata } from "next";
import { PretDetailApiScreen } from "@/features/finances/apiScreens";
import { ApiWithId } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Prêt immobilier" };

export default function Page({ params }: PageProps<"/finances/prets/[id]">) {
  return <ApiWithId params={params}>{(id) => <PretDetailApiScreen id={id} />}</ApiWithId>;
}
