import type { Metadata } from "next";
import { InterventionFormPage } from "@/features/interventions/InterventionFormPage";

export const metadata: Metadata = { title: "Nouvelle intervention" };

export default function Page() {
  return <InterventionFormPage />;
}
