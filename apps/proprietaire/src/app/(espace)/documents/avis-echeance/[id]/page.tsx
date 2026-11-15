import { demoNoticeIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { AvisEcheanceApercuScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Avis d’échéance" };

export function generateStaticParams() {
  return demoNoticeIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/documents/avis-echeance/[id]">) {
  return <WithId params={params}>{(id) => <AvisEcheanceApercuScreen id={id} />}</WithId>;
}
