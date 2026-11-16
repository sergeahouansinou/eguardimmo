import type { Metadata } from "next";
import { EtatsLieuxScreen } from "@/features/gestion/screens";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "États des lieux" };

export default function Page() {
  return <ApiOnly><EtatsLieuxScreen /></ApiOnly>;
}
