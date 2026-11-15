import { demoCourrierIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { CourrierApercuScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Courrier" };

export function generateStaticParams() {
  return demoCourrierIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/documents/courriers/[id]">) {
  return <WithId params={params}>{(id) => <CourrierApercuScreen id={id} />}</WithId>;
}
