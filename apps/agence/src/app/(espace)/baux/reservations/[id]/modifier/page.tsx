import type { Metadata } from "next";
import { ReservationFormScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Modifier la réservation" };

export default function Page({ params }: PageProps<"/baux/reservations/[id]/modifier">) {
  return <WithId params={params}>{(id) => <ReservationFormScreen id={id} />}</WithId>;
}
