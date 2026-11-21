import type { Metadata } from "next";
import { ChargesExerciceDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Exercice de charges" };

export default function Page({ params }: PageProps<"/finances/charges/[id]">) {
  return <WithId params={params}>{(id) => <ChargesExerciceDetailScreen id={id} />}</WithId>;
}
