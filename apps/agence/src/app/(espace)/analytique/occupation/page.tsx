import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { AnalytiqueOccupationScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Occupation" };

export default function Page() {
  return <ApiOnly><AnalytiqueOccupationScreen /></ApiOnly>;
}
