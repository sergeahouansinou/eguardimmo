import type { Metadata } from "next";
import { InterventionsScreen } from "@/features/confie/screens/InterventionsScreen";
import { dataSource } from "@/lib/env";
import { InterventionsScreen as ApiInterventionsScreen } from "@/owner/interventions/InterventionsScreen";

export const metadata: Metadata = { title: "Interventions" };

export default function Page() {
  return dataSource === "api" ? <ApiInterventionsScreen /> : <InterventionsScreen />;
}
