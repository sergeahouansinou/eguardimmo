import type { Metadata } from "next";
import { ApiWithId } from "@/features/finances/gates";
import { TacheDetailApiScreen } from "@/features/outils/screensOrg";

export const metadata: Metadata = { title: "Tâche" };

export default function Page({ params }: PageProps<"/taches/[id]">) {
  return <ApiWithId params={params}>{(id) => <TacheDetailApiScreen id={id} />}</ApiWithId>;
}
