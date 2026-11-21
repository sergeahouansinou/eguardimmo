import type { Metadata } from "next";
import { AnalytiqueVueApiScreen } from "@/features/outils/screensOrg";
import { AnalytiqueVueScreen } from "@/features/outils/screensOutils";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Analytique" };

export default function Page() {
  return dataSource === "api" ? <AnalytiqueVueApiScreen /> : <AnalytiqueVueScreen />;
}
