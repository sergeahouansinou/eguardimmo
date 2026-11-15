import type { Metadata } from "next";
import { AnalytiqueRentaScreen } from "@/features/outils/screensOutils";

export const metadata: Metadata = { title: "Rentabilité par bien" };

export default function Page() {
  return <AnalytiqueRentaScreen />;
}
