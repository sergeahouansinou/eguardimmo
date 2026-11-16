import type { Metadata } from "next";
import { ReservationsScreen } from "@/features/gestion/screens";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Réservations" };

export default function Page() {
  return <ApiOnly><ReservationsScreen /></ApiOnly>;
}
