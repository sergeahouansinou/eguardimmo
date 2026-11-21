import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { LoyersPaiementsScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Paiements de loyer" };

export default function Page() {
  return <ApiOnly><LoyersPaiementsScreen /></ApiOnly>;
}
