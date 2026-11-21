import type { Metadata } from "next";
import { TacheFormScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Modifier la tâche" };

export default function Page({ params }: PageProps<"/taches/[id]/modifier">) {
  return <WithId params={params}>{(id) => <TacheFormScreen id={id} />}</WithId>;
}
