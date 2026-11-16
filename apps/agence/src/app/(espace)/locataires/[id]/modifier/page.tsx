import type { Metadata } from "next";
import { LocataireFormScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Modifier le locataire" };

export default function Page({ params }: PageProps<"/locataires/[id]/modifier">) {
  return <WithId params={params}>{(id) => <LocataireFormScreen id={id} />}</WithId>;
}
