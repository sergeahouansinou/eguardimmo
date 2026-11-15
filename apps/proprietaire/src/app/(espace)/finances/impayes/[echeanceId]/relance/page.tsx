import type { Metadata } from "next";
import { PlannedFinances } from "@/features/finances/PlannedFinances";

export const metadata: Metadata = { title: "Aperçu de la relance" };

export default function Page() {
  return <PlannedFinances title="Aperçu de la relance" />;
}
