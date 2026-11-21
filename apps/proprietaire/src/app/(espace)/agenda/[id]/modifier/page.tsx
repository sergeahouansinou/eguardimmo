import type { Metadata } from "next";
import { ApiWithId } from "@/features/finances/gates";
import { EvenementFormApiScreen } from "@/features/outils/screensOrg";

export const metadata: Metadata = { title: "Modifier l’événement" };

export default function Page({ params }: PageProps<"/agenda/[id]/modifier">) {
  return <ApiWithId params={params}>{(id) => <EvenementFormApiScreen id={id} />}</ApiWithId>;
}
