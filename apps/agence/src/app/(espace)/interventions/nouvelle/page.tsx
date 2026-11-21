import type { Metadata } from "next";
import { InterventionFormApiScreen } from "@/features/gestion/screens";
import { InterventionFormPage } from "@/features/interventions/InterventionFormPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Nouvelle intervention" };

export default function Page() {
  if (dataSource === "api") return <InterventionFormApiScreen />;
  return <InterventionFormPage />;
}
