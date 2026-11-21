import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { FacturesScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Factures et avoirs" };

export default function Page() {
  return <ApiOnly><FacturesScreen /></ApiOnly>;
}
