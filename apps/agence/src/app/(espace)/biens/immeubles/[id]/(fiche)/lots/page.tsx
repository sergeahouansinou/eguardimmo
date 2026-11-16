import { ImmeubleLots } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Lots de l’immeuble" };

export default function Page({ params }: PageProps<"/biens/immeubles/[id]/lots">) {
  return <WithId params={params}>{(id) => <ImmeubleLots id={id} />}</WithId>;
}
