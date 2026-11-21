import type { Metadata } from "next";
import { PrestatairesApiScreen } from "@/features/interventions/screens";
import { ApiOnly } from "@/features/loyers/ApiOnly";

export const metadata: Metadata = { title: "Prestataires" };

export default function Page() {
  return <ApiOnly><PrestatairesApiScreen /></ApiOnly>;
}
