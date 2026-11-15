import type { Metadata } from "next";
import { CompteScreen } from "@/features/outils/screensCompte";

export const metadata: Metadata = { title: "Mon compte" };

export default function Page() {
  return <CompteScreen />;
}
