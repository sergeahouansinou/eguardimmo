import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { AssurancesScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Assurances des locataires" };

export default function Page() {
  return <ApiOnly><AssurancesScreen /></ApiOnly>;
}
