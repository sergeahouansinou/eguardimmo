import type { Metadata } from "next";
import { PaiementScreen } from "@/features/finances/screens";
import { LoyerPaiementFormScreen } from "@/features/loyers/screens";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Enregistrer un paiement" };

export default function Page() {
  if (dataSource === "api") return <LoyerPaiementFormScreen />;
  return <PaiementScreen />;
}
