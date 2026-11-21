import type { Metadata } from "next";
import { JournalApiScreen } from "@/features/outils/screensOrg";
import { JournalScreen } from "@/features/outils/screensCompte";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Journal d'activité" };

export default function Page() {
  return dataSource === "api" ? <JournalApiScreen /> : <JournalScreen />;
}
