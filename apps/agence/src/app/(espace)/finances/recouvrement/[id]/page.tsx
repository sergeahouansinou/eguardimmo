import type { Metadata } from "next";
import { DossierRecouvrementScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Dossier de recouvrement" };

export default function Page({ params }: PageProps<"/finances/recouvrement/[id]">) {
  return <WithId params={params}>{(id) => <DossierRecouvrementScreen id={id} />}</WithId>;
}
