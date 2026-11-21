import type { Metadata } from "next";
import { InterventionsApiScreen } from "@/features/interventions/screens";
import { InterventionsScreen } from "@/features/outils/screensSuivi";
import { dataSource } from "@/lib/env";

export const metadata: Metadata = { title: "Interventions" };

export default function Page() {
  if (dataSource === "api") return <InterventionsApiScreen />;
  return <InterventionsScreen />;
}
