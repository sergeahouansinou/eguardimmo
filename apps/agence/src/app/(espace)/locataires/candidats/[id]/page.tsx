import type { Metadata } from "next";
import { CandidatDossierScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Dossier du candidat" };

export default function Page({ params }: PageProps<"/locataires/candidats/[id]">) {
  return <WithId params={params}>{(id) => <CandidatDossierScreen id={id} />}</WithId>;
}
