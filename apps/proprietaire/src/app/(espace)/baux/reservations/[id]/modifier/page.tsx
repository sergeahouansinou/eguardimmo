import { demoReservationIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { ReservationFormScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Modifier la réservation" };

export function generateStaticParams() {
  return demoReservationIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/baux/reservations/[id]/modifier">) {
  return <WithId params={params}>{(id) => <ReservationFormScreen id={id} />}</WithId>;
}
