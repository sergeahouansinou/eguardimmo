import type { Metadata } from "next";
import { ReservationContratScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Contrat de location" };

export default function Page({ params }: PageProps<"/baux/reservations/[id]/contrat">) {
  return <WithId params={params}>{(id) => <ReservationContratScreen id={id} />}</WithId>;
}
