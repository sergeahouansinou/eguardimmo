import type { Metadata } from "next";
import { InterventionFormApiScreen } from "@/features/interventions/screens";
import { InterventionFormScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Nouvelle intervention" };

export default function Page() {
  if (dataSource === "api") return <InterventionFormApiScreen />;
  return <InterventionFormScreen />;
}
