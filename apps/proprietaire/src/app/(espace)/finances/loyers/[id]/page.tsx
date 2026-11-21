import type { Metadata } from "next";
import { WithId } from "@/features/locataires/WithId";
import { ApiOnly } from "@/features/loyers/ApiOnly";
import { LoyerDetailScreen } from "@/features/loyers/screens";

export const metadata: Metadata = { title: "Échéance de loyer" };

export default function Page({ params }: PageProps<"/finances/loyers/[id]">) {
  return (
    <ApiOnly>
      <WithId params={params}>{(id) => <LoyerDetailScreen id={id} />}</WithId>
    </ApiOnly>
  );
}
