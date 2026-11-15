import type { Metadata } from "next";
import { AnalytiqueOccScreen } from "@/features/outils/screensOutils";

export const metadata: Metadata = { title: "Occupation" };

export default function Page() {
  return <AnalytiqueOccScreen />;
}
