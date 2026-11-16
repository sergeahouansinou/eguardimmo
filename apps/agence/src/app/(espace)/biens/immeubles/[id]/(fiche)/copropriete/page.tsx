import { ImmeubleCopro } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Copropriété" };

export default function Page({ params }: PageProps<"/biens/immeubles/[id]/copropriete">) {
  return <WithId params={params}>{(id) => <ImmeubleCopro id={id} />}</WithId>;
}
