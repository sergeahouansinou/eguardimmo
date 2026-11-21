import type { Metadata } from "next";
import { AnalytiqueRentaApiScreen } from "@/features/outils/screensOrg";
import { AnalytiqueRentaScreen } from "@/features/outils/screensOutils";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Rentabilité par bien" };

export default function Page() {
  return dataSource === "api" ? <AnalytiqueRentaApiScreen /> : <AnalytiqueRentaScreen />;
}
