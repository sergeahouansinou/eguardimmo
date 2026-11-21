import type { Metadata } from "next";
import { ApiWithId } from "@/features/finances/gates";
import { EvenementDetailApiScreen } from "@/features/outils/screensOrg";

export const metadata: Metadata = { title: "Événement" };

export default function Page({ params }: PageProps<"/agenda/[id]">) {
  return <ApiWithId params={params}>{(id) => <EvenementDetailApiScreen id={id} />}</ApiWithId>;
}
