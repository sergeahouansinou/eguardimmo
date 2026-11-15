import type { Metadata } from "next";
import { EquipeScreen } from "@/features/outils/screensCompte";

export const metadata: Metadata = { title: "Équipe" };

export default function Page() {
  return <EquipeScreen />;
}
