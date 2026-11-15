import type { Metadata } from "next";
import { ReglagesDocumentsScreen } from "@/features/outils/screensCompte";

export const metadata: Metadata = { title: "Réglages, documents et quittances" };

export default function Page() {
  return <ReglagesDocumentsScreen />;
}
