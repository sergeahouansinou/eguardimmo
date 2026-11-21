import type { Metadata } from "next";
import { WithId } from "@/features/locataires/WithId";
import { ApiOnly } from "@/features/loyers/ApiOnly";
import { LoyerQuittanceDetailScreen } from "@/features/loyers/screens";

export const metadata: Metadata = { title: "Quittance de loyer" };

export default function Page({ params }: PageProps<"/finances/loyers/quittances/[id]">) {
  return (
    <ApiOnly>
      <WithId params={params}>{(id) => <LoyerQuittanceDetailScreen id={id} />}</WithId>
    </ApiOnly>
  );
}
