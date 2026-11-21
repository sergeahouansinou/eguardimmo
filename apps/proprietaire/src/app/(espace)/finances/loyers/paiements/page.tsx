import type { Metadata } from "next";
import { ApiOnly } from "@/features/loyers/ApiOnly";
import { LoyersPaiementsScreen } from "@/features/loyers/screens";

export const metadata: Metadata = { title: "Paiements de loyer" };

export default function Page() {
  return <ApiOnly><LoyersPaiementsScreen /></ApiOnly>;
}
