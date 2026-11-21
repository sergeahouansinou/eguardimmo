import type { Metadata } from "next";
import { FiscaliteDetailApiScreen } from "@/features/finances/apiScreens";
import { ApiWithId } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Synthèse fiscale" };

export default function Page({ params }: PageProps<"/finances/fiscalite/[id]">) {
  return <ApiWithId params={params}>{(id) => <FiscaliteDetailApiScreen id={id} />}</ApiWithId>;
}
