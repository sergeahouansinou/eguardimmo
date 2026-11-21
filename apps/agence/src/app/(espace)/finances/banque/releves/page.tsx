import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { BanqueRelevesScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Relevés bancaires" };

export default function Page() {
  return <ApiOnly><BanqueRelevesScreen /></ApiOnly>;
}
