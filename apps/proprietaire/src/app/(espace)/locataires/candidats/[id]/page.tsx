import { demoCandidateIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { CandidatDossierScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Dossier du candidat" };

export function generateStaticParams() {
  return demoCandidateIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/locataires/candidats/[id]">) {
  return <WithId params={params}>{(id) => <CandidatDossierScreen id={id} />}</WithId>;
}
