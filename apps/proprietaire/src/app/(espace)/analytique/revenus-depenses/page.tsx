import type { Metadata } from "next";
import { AnalytiqueRevDepScreen } from "@/features/outils/screensOutils";

export const metadata: Metadata = { title: "Revenus et dépenses" };

export default function Page() {
  return <AnalytiqueRevDepScreen />;
}
