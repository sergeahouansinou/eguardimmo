import type { Metadata } from "next";
import { ReservationFormScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Nouvelle réservation" };

export default function Page() {
  return <ReservationFormScreen />;
}
