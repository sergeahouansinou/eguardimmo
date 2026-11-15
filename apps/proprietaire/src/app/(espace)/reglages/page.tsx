import type { Metadata } from "next";
import { ReglagesScreen } from "@/features/outils/screensCompte";

export const metadata: Metadata = { title: "Réglages" };

export default function Page() {
  return <ReglagesScreen />;
}
