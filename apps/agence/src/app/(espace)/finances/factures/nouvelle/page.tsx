import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { FactureFormScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Nouvelle facture" };

export default function Page() {
  return <ApiOnly><FactureFormScreen /></ApiOnly>;
}
