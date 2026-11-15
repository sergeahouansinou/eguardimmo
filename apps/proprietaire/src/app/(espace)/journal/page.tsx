import type { Metadata } from "next";
import { JournalScreen } from "@/features/outils/screensCompte";

export const metadata: Metadata = { title: "Journal d'activité" };

export default function Page() {
  return <JournalScreen />;
}
