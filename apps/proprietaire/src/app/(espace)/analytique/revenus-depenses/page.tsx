import type { Metadata } from "next";
import { AnalytiqueRevDepApiScreen } from "@/features/outils/screensOrg";
import { AnalytiqueRevDepScreen } from "@/features/outils/screensOutils";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Revenus et dépenses" };

export default function Page() {
  return dataSource === "api" ? <AnalytiqueRevDepApiScreen /> : <AnalytiqueRevDepScreen />;
}
