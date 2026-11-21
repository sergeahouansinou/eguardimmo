import type { Metadata } from "next";
import { PieceConformiteScreen } from "@/features/conformite/screens";
import { WithId } from "@/features/locataires/WithId";
import { ApiOnly } from "@/features/loyers/ApiOnly";

export const metadata: Metadata = { title: "Pièce de conformité" };

export default function Page({ params }: PageProps<"/conformite/[id]">) {
  return (
    <ApiOnly>
      <WithId params={params}>{(id) => <PieceConformiteScreen id={id} />}</WithId>
    </ApiOnly>
  );
}
