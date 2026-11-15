import type { Metadata } from "next";
import { PaiementScreen } from "@/features/finances/screens";

export const metadata: Metadata = { title: "Enregistrer un paiement" };

export default function Page() {
  return <PaiementScreen />;
}
