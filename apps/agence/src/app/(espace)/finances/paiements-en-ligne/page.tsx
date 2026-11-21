import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { PaiementsEnLigneScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Paiements en ligne" };

export default function Page() {
  return <ApiOnly><PaiementsEnLigneScreen /></ApiOnly>;
}
