import type { Metadata } from "next";
import { AnalytiqueOccApiScreen } from "@/features/outils/screensOrg";
import { AnalytiqueOccScreen } from "@/features/outils/screensOutils";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Occupation" };

export default function Page() {
  return dataSource === "api" ? <AnalytiqueOccApiScreen /> : <AnalytiqueOccScreen />;
}
