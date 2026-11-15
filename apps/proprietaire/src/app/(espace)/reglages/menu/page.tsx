import type { Metadata } from "next";
import { ReglagesMenuScreen } from "@/features/outils/screensCompte";

export const metadata: Metadata = { title: "Réglages, menu et rubriques" };

export default function Page() {
  return <ReglagesMenuScreen />;
}
