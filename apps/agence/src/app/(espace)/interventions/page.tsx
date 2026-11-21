import type { Metadata } from "next";
import { InterventionsApiScreen } from "@/features/gestion/screens";
import { InterventionsPage } from "@/features/interventions/InterventionsPage";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Interventions" };

export default function Page() {
  if (dataSource === "api") return <InterventionsApiScreen />;
  return <InterventionsPage />;
}
