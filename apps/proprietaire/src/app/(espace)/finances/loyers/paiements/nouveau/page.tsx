import type { Metadata } from "next";
import { ApiOnly } from "@/features/loyers/ApiOnly";
import { LoyerPaiementFormScreen } from "@/features/loyers/screens";

export const metadata: Metadata = { title: "Enregistrer un paiement de loyer" };

export default function Page() {
  return <ApiOnly><LoyerPaiementFormScreen /></ApiOnly>;
}
