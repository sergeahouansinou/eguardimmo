import type { Metadata } from "next";
import { CompteSupprimeScreen } from "@/features/connexion/StatusScreens";

export const metadata: Metadata = { title: "Compte supprimé" };

export default function Page() {
  return <CompteSupprimeScreen />;
}
