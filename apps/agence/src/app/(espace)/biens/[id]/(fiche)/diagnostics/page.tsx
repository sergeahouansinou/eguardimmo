import { LotDiagnostics } from "@eguardimmo/gestion/biens";
import type { Metadata } from "next";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Diagnostics du lot" };

export default function Page({ params }: PageProps<"/biens/[id]/diagnostics">) {
  return <WithId params={params}>{(id) => <LotDiagnostics id={id} />}</WithId>;
}
