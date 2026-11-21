import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { DepensesScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Dépenses" };

export default function Page() {
  return <ApiOnly><DepensesScreen /></ApiOnly>;
}
