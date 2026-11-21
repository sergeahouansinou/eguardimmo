import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { AnalytiqueRevenusScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Revenus et dépenses" };

export default function Page() {
  return <ApiOnly><AnalytiqueRevenusScreen /></ApiOnly>;
}
