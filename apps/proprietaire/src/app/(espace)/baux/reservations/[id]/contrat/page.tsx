import { demoReservationIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { ReservationContratScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Contrat de location" };

export function generateStaticParams() {
  return demoReservationIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/baux/reservations/[id]/contrat">) {
  return <WithId params={params}>{(id) => <ReservationContratScreen id={id} />}</WithId>;
}
