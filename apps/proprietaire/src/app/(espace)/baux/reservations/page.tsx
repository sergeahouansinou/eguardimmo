import type { Metadata } from "next";
import { ReservationsScreen } from "@/features/locataires/screens";

export const metadata: Metadata = { title: "Réservations" };

export default function Page() {
  return <ReservationsScreen />;
}
