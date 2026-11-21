import type { Metadata } from "next";
import { EvenementFormScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Modifier l’événement" };

export default function Page({ params }: PageProps<"/agenda/[id]/modifier">) {
  return <WithId params={params}>{(id) => <EvenementFormScreen id={id} />}</WithId>;
}
