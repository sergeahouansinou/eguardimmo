import type { Metadata } from "next";
import { PlannedPage } from "@/features/locataires/PlannedPage";

export const metadata: Metadata = { title: "Nouvelle réservation" };

export default function Page() {
  return <PlannedPage title="Nouvelle réservation" />;
}
