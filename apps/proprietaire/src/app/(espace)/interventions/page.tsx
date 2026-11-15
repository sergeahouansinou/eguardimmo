import type { Metadata } from "next";
import { InterventionsScreen } from "@/features/outils/screensSuivi";

export const metadata: Metadata = { title: "Interventions" };

export default function Page() {
  return <InterventionsScreen />;
}
