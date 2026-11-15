import type { Metadata } from "next";
import { AnalytiqueVueScreen } from "@/features/outils/screensOutils";

export const metadata: Metadata = { title: "Analytique" };

export default function Page() {
  return <AnalytiqueVueScreen />;
}
