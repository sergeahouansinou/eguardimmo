import type { Metadata } from "next";
import { AbonnementScreen } from "@/features/outils/screensCompte";

export const metadata: Metadata = { title: "Abonnement" };

export default function Page() {
  return <AbonnementScreen />;
}
