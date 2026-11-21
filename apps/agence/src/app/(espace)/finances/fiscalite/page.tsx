import type { Metadata } from "next";
import { ApiOnly } from "@/features/gestion/ApiOnly";
import { FiscaliteScreen } from "@/features/gestion/screens";

export const metadata: Metadata = { title: "Fiscalité des mandants" };

export default function Page() {
  return <ApiOnly><FiscaliteScreen /></ApiOnly>;
}
