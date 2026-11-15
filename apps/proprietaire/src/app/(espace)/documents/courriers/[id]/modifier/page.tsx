import { demoCourrierIds } from "@eguardimmo/gestion";
import type { Metadata } from "next";
import { CourrierFormScreen } from "@/features/locataires/screens";
import { WithId } from "@/features/locataires/WithId";

export const metadata: Metadata = { title: "Modifier le courrier" };

export function generateStaticParams() {
  return demoCourrierIds.map((id) => ({ id }));
}

export default function Page({ params }: PageProps<"/documents/courriers/[id]/modifier">) {
  return <WithId params={params}>{(id) => <CourrierFormScreen id={id} />}</WithId>;
}
