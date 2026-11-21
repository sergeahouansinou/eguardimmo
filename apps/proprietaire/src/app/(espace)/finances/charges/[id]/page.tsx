import type { Metadata } from "next";
import { ChargesExerciceDetailApiScreen } from "@/features/finances/apiScreens";
import { ApiWithId } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Exercice de charges" };

export default function Page({ params }: PageProps<"/finances/charges/[id]">) {
  return <ApiWithId params={params}>{(id) => <ChargesExerciceDetailApiScreen id={id} />}</ApiWithId>;
}
