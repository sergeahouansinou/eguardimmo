import type { Metadata } from "next";
import { ReservationFormScreen } from "@/features/gestion/screens";
import { ApiOnly } from "@/features/gestion/ApiOnly";

export const metadata: Metadata = { title: "Nouvelle réservation" };

export default function Page() {
  return <ApiOnly><ReservationFormScreen /></ApiOnly>;
}
