import { demoAttestationIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { AttestationApercuScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Attestation de restitution" };

export function generateStaticParams() {
  return demoAttestationIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/documents/attestations/[id]">) {
  return <WithId params={params}>{(id) => <AttestationApercuScreen id={id} />}</WithId>;
}
