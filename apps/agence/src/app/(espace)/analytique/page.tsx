import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { AnalytiqueScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Analytique" };

export default function Page() {
  return <ApiOnly><AnalytiqueScreen /></ApiOnly>;
}
