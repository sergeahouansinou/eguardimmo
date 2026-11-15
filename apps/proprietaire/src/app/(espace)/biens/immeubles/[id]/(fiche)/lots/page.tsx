import { ImmeubleLots } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "../../../../WithId";

export const metadata: Metadata = { title: "Lots de l’immeuble" };

export default function Page({ params }: PageProps<"/biens/immeubles/[id]/lots">) {
  return <WithId params={params}>{(id) => <ImmeubleLots id={id} />}</WithId>;
}
