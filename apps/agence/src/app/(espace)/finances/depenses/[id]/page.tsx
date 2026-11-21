import type { Metadata } from "next";
import { DepenseDetailScreen } from "@/features/gestion/screens";
import { WithId } from "@/features/gestion/WithId";

export const metadata: Metadata = { title: "Dépense" };

export default function Page({ params }: PageProps<"/finances/depenses/[id]">) {
  return <WithId params={params}>{(id) => <DepenseDetailScreen id={id} />}</WithId>;
}
