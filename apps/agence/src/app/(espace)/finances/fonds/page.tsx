import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { FondsTiersApiScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Fonds de tiers" };

export default function Page() {
  return <ApiOnly><FondsTiersApiScreen /></ApiOnly>;
}
