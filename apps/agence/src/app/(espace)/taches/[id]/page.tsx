import type { Metadata } from "next";
import { TacheDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Tâche" };

export default function Page({ params }: PageProps<"/taches/[id]">) {
  return <WithId params={params}>{(id) => <TacheDetailScreen id={id} />}</WithId>;
}
