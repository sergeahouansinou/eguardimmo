import type { Metadata } from "next";
import { InterventionsPage } from "@/features/interventions/InterventionsPage";

export const metadata: Metadata = { title: "Interventions" };

export default function Page() {
  return <InterventionsPage />;
}
