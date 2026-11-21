import type { Metadata } from "next";
import { DepenseDetailApiScreen } from "@/features/finances/apiScreens";
import { ApiWithId } from "@/features/finances/gates";

export const metadata: Metadata = { title: "Dépense" };

export default function Page({ params }: PageProps<"/finances/depenses/[id]">) {
  return <ApiWithId params={params}>{(id) => <DepenseDetailApiScreen id={id} />}</ApiWithId>;
}
