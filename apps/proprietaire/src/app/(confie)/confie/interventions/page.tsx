import type { Metadata } from "next";
import { InterventionsScreen } from "@/features/confie/screens/InterventionsScreen";

export const metadata: Metadata = { title: "Interventions" };

export default function Page() {
  return <InterventionsScreen />;
}
