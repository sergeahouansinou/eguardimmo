import type { Metadata } from "next";
import { FactureFormScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Modifier le brouillon" };

export default function Page({ params }: PageProps<"/finances/factures/[id]/modifier">) {
  return <WithId params={params}>{(id) => <FactureFormScreen id={id} />}</WithId>;
}
